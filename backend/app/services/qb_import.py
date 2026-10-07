"""SQL -> query-builder spec (the way back from the Workbench).

`sql_to_spec` first tries a structured conversion (single SELECT: source + joins, WHERE, GROUP BY / aggregates, HAVING, window
and other expressions as custom columns, ORDER BY, LIMIT). The result is only trusted after a round-trip check: the spec is
compiled back to SQL and both queries are run; if columns / rows differ, or anything is unsupported, the query is kept whole as a
raw-SQL first stage (`{"sql": ...}`) that further stages can build on. So a transfer is either exact or clearly labelled "wrapped".
"""
from __future__ import annotations

import sqlglot
from sqlglot import expressions as exp

from ..core.store import store
from .qb_check import same_result

CMP = {exp.EQ: "=", exp.NEQ: "!=", exp.GT: ">", exp.GTE: ">=", exp.LT: "<", exp.LTE: "<="}
SIMPLE_AGG = {exp.Sum: "sum", exp.Avg: "avg", exp.Min: "min", exp.Max: "max"}
JOIN_KIND = {"LEFT": "left", "RIGHT": "right", "FULL": "full"}


class Unsupported(Exception):
    pass


def _dataset(name: str) -> dict:
    rows = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    low = name.lower()
    hit = next((d for d in rows if d["physical_name"].lower() == low), None) or next((d for d in rows if d["name"].lower() == low), None)
    if not hit:
        raise Unsupported(f"'{name}' is not a table in the builder (it may be a Workbench step)")
    return hit


def _literal(n):
    if isinstance(n, exp.Literal):
        return n.name if n.is_string else (float(n.name) if "." in n.name or "e" in n.name.lower() else int(n.name))
    if isinstance(n, exp.Boolean):
        return bool(n.this)
    raise Unsupported("non-literal value")


class _Importer:
    def __init__(self, tree: exp.Select):
        self.t = tree
        src = tree.args.get("from_") or tree.args.get("from")
        if not src or not isinstance(src.this, exp.Table) or src.this.args.get("db"):
            raise Unsupported("the query does not read from a single table")
        self.joins = tree.args.get("joins") or []
        self.tables, self.alias = [], {}
        for i, node in enumerate([src.this] + [j.this for j in self.joins]):
            if not isinstance(node, exp.Table) or node.args.get("db"):
                raise Unsupported("joins on sub-queries are not supported")
            d = _dataset(node.name)
            self.tables.append(d)
            self.alias[(node.alias or node.name).lower()] = f"t{i}"
        self.cols = {f"t{i}": {c["name"].lower() for c in store.list("columns_meta", where="dataset_id = ?", params=[d["id"]], order=None)} for i, d in enumerate(self.tables)}
        self.custom: list[dict] = []

    # ---- references and expression text
    def ref(self, col: exp.Column):
        name = col.name
        if not self.joins:
            if col.table and col.table.lower() not in self.alias:
                raise Unsupported("unknown table qualifier")
            return name
        if col.table:
            t = self.alias.get(col.table.lower())
            if not t:
                raise Unsupported("unknown table qualifier")
        else:
            owners = [t for t, cs in self.cols.items() if name.lower() in cs]
            if len(owners) != 1:
                raise Unsupported(f"column '{name}' is ambiguous or unknown")
            t = owners[0]
        return {"t": t, "c": name}

    def text(self, node: exp.Expression) -> str:
        node = node.copy()
        for c in list(node.find_all(exp.Column)):
            if self.joins and c.table and c.table.lower() in self.alias:
                c.set("table", exp.to_identifier(self.alias[c.table.lower()]))
            elif not self.joins:
                c.set("table", None)
        return node.sql(dialect="duckdb")

    def add_custom(self, name: str, node: exp.Expression) -> str:
        self.custom.append({"name": name, "expr": self.text(node)})
        return name

    # ---- WHERE / HAVING
    def conds(self, node, on_col=None) -> list[dict]:
        out = []
        for c in (list(node.flatten()) if isinstance(node, exp.And) else [node]):
            out.append(self.cond(c, on_col))
        return out

    def cond(self, c, on_col=None) -> dict:
        col = on_col or self.ref
        try:
            kind = next((k for k in CMP if type(c) is k), None)
            if kind and isinstance(c.this, exp.Column):
                return {"col": col(c.this), "op": CMP[kind], "value": _literal(c.expression)}
            if isinstance(c, exp.Between) and isinstance(c.this, exp.Column):
                return {"col": col(c.this), "op": "between", "value": _literal(c.args["low"]), "value2": _literal(c.args["high"])}
            if isinstance(c, exp.In) and isinstance(c.this, exp.Column) and c.expressions and not c.args.get("query"):
                return {"col": col(c.this), "op": "in", "value": [_literal(x) for x in c.expressions]}
            if isinstance(c, exp.Is) and isinstance(c.this, exp.Column) and isinstance(c.expression, exp.Null):
                return {"col": col(c.this), "op": "is_null"}
            if isinstance(c, exp.Not) and isinstance(c.this, exp.Is) and isinstance(c.this.this, exp.Column) and isinstance(c.this.expression, exp.Null):
                return {"col": col(c.this.this), "op": "not_null"}
        except Unsupported:
            if on_col:
                raise
        if on_col:
            raise Unsupported("this HAVING condition is not on a summary column")
        return {"op": "expr", "value": self.text(c)}

    # ---- the stage
    def build(self) -> dict:
        t, st = self.t, {}
        for k in ("with_", "with", "qualify", "offset", "windows", "laterals"):
            if t.args.get(k):
                raise Unsupported("WITH / OFFSET / QUALIFY are not supported")
        st["table"] = self.tables[0]["name"]
        if self.joins:
            st["joins"] = [self.join(i, j) for i, j in enumerate(self.joins, 1)]
        items = [(e.this if isinstance(e, exp.Alias) else e, e.alias if isinstance(e, exp.Alias) else "") for e in t.expressions]
        grouped = bool(t.args.get("group")) or any(it.find(exp.AggFunc) and not it.find(exp.Window) for it, _ in items)
        if grouped:
            self.summary(st, items)
        else:
            self.plain(st, items)
        if t.args.get("where"):
            where = t.args["where"].this
            if isinstance(where, exp.Or):
                st["filters"] = [{"op": "expr", "value": self.text(where)}]
            else:
                st["filters"] = self.conds(where)
        if self.custom:
            st["custom"] = self.custom
        if t.args.get("order"):
            st["sort"] = [self.order(o, items) for o in t.args["order"].expressions]
        if t.args.get("limit"):
            lim = t.args["limit"].expression
            st["limit"] = _literal(lim)
        return st

    def join(self, i: int, j: exp.Join) -> dict:
        kind = "cross" if (j.args.get("kind") or "").upper() == "CROSS" else JOIN_KIND.get((j.args.get("side") or "").upper(), "inner")
        on = []
        if j.args.get("on"):
            for p in (list(j.args["on"].flatten()) if isinstance(j.args["on"], exp.And) else [j.args["on"]]):
                if not (isinstance(p, exp.EQ) and isinstance(p.this, exp.Column) and isinstance(p.expression, exp.Column)):
                    raise Unsupported("join conditions other than column = column")
                on.append({"left": self.ref(p.this), "right": self.ref(p.expression)})
        if j.args.get("using"):
            raise Unsupported("JOIN ... USING")
        return {"table": self.tables[i]["name"], "type": kind, "on": on}

    def plain(self, st: dict, items) -> None:
        if self.t.args.get("having"):
            raise Unsupported("HAVING without GROUP BY")
        if self.t.args.get("distinct"):
            st["distinct"] = True
        if len(items) == 1 and isinstance(items[0][0], exp.Star) and not items[0][0].args.get("except_"):
            return
        cols = []
        for node, alias in items:
            if isinstance(node, exp.Star) or (isinstance(node, exp.Column) and isinstance(node.this, exp.Star)):
                raise Unsupported("* mixed with other columns")
            if isinstance(node, exp.Column):
                r = self.ref(node)
                cols.append({**(r if isinstance(r, dict) else {"c": r}), "as": alias} if alias and alias != node.name else r)
            else:
                if not alias:
                    raise Unsupported("an expression without a name (add AS name)")
                cols.append(self.add_custom(alias, node))
        st["columns"] = cols

    def summary(self, st: dict, items) -> None:
        group = list(self.t.args["group"].expressions) if self.t.args.get("group") else []
        keys = []
        for g in group:
            if isinstance(g, exp.Literal) and not g.is_string:
                g = items[int(g.name) - 1][0]
            elif isinstance(g, exp.Column) and not g.table:
                g = next((n for n, a in items if a and a.lower() == g.name.lower()), g)
            keys.append(self.text(g))
        brk, aggs, names = [], [], {}
        for node, alias in items:
            if self.text(node) in keys and not node.find(exp.AggFunc):
                if isinstance(node, exp.Column):
                    r = self.ref(node)
                    brk.append({"col": r, "as": alias or node.name})
                else:
                    if not alias:
                        raise Unsupported("a grouped expression without a name")
                    brk.append({"col": self.add_custom(alias, node), "as": alias})
                names[self.text(node)] = brk[-1]["as"]
            elif node.find(exp.AggFunc):
                if node.find(exp.Window):
                    raise Unsupported("window functions in a summary")
                aggs.append(self.agg(node, alias))
                names[self.text(node)] = alias or aggs[-1].get("as", "")
            else:
                raise Unsupported("a column that is neither grouped nor summarised")
        st["breakouts"], st["aggregations"] = brk, aggs
        if self.t.args.get("having"):
            def by_alias(c: exp.Column):
                if not c.table and c.name in set(names.values()):
                    return c.name
                raise Unsupported("HAVING on something that is not a named summary column")
            h = self.t.args["having"].this
            for c in h.find_all(exp.AggFunc):
                nm = names.get(self.text(c))
                if not nm:
                    raise Unsupported("HAVING on an unnamed aggregate")
                c.replace(exp.column(nm))
            st["having"] = self.conds(h, by_alias)

    def agg(self, node: exp.Expression, alias: str) -> dict:
        out: dict = {"fn": "expr", "expr": self.text(node)}
        arg = node.this if isinstance(node, exp.AggFunc) else None
        if isinstance(node, exp.Count):
            if isinstance(arg, exp.Star):
                out = {"fn": "count"}
            elif isinstance(arg, exp.Distinct) and len(arg.expressions) == 1 and isinstance(arg.expressions[0], exp.Column):
                out = {"fn": "count_distinct", "col": self.ref(arg.expressions[0])}
            elif isinstance(arg, exp.Column):
                out = {"fn": "count_col", "col": self.ref(arg)}
        elif type(node) in SIMPLE_AGG and isinstance(arg, exp.Column):
            out = {"fn": SIMPLE_AGG[type(node)], "col": self.ref(arg)}
        if alias:
            out["as"] = alias
        return out

    def order(self, o: exp.Ordered, items) -> dict:
        n = o.this
        if isinstance(n, exp.Literal) and not n.is_string:
            node, alias = items[int(n.name) - 1]
            n = exp.column(alias) if alias else node
        if not isinstance(n, exp.Column):
            raise Unsupported("ORDER BY an expression")
        aliases = {a.lower() for _, a in items if a}
        grouped = bool(self.t.args.get("group"))
        if grouped or (not n.table and n.name.lower() in aliases):
            return {"col": n.name, "dir": "desc" if o.args.get("desc") else "asc"}
        return {"col": self.ref(n), "dir": "desc" if o.args.get("desc") else "asc"}


def _structured(sql: str) -> dict:
    try:
        tree = sqlglot.parse_one(sql, read="duckdb")
    except Exception as e:  # noqa: BLE001
        raise Unsupported("the SQL could not be read") from e
    if not isinstance(tree, exp.Select):
        raise Unsupported("only a single SELECT can be shown as steps")
    return {"stages": [_Importer(tree).build()]}


def sql_to_spec(sql: str) -> dict:
    """{spec, fidelity: 'exact' | 'wrapped', notes: [..]}; never raises for SQL the builder cannot express."""
    sql = sql.strip().rstrip(";").strip()
    if not sql:
        raise ValueError("there is no SQL to open")
    why = ""
    try:
        spec = _structured(sql)
        why = same_result(sql, spec) or ""
        if not why:
            return {"spec": spec, "fidelity": "exact", "notes": []}
    except Unsupported as e:
        why = str(e)
    except Exception as e:  # noqa: BLE001
        why = f"unexpected: {str(e)[:120]}"
    return {"spec": {"stages": [{"sql": sql}, {"limit": 1000}]}, "fidelity": "wrapped",
            "notes": [f"Kept as SQL because {why}. You can still add filters, summaries and sorting on top."]}
