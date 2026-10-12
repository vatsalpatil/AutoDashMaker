"""The operations Edit with AI can apply to a dashboard (add, update, remove, move, arrange, resize, note, rename, add_page).

`Editor` keeps an in-memory index of the dashboard's widgets so a sequence of ops sees each other's effects (a chart added
"after the KPIs" pushes the rest down, an arrange sees the KPI that was just added). Each `apply` returns a sentence for the
user or raises ValueError with the reason it was skipped.
"""
from __future__ import annotations

import re
from typing import Any

from ..core.store import store
from .dash_ai import _layout, _materialize, _store_widget
from .dash_place import anchor_y, grid_positions, make_room


class Editor:
    def __init__(self, dash: dict[str, Any], index: dict[str, dict], viewing: str, context: str, provider_id: str | None):
        self.dash, self.index, self.viewing, self.context, self.provider_id = dash, index, viewing, context, provider_id
        self.pages = [p for p in (dash.get("pages") or []) if isinstance(p, dict) and p.get("id")] or [{"id": "main", "name": "Overview"}]
        self.touched = viewing
        self.changed_ids: list[str] = []
        self.aliases: dict[str, str] = {}   # page id the model chose -> the id actually saved

    @property
    def page_name(self) -> dict[str, str]:
        return {p["id"]: p.get("name", p["id"]) for p in self.pages}

    def _page_of(self, wid: str) -> str:
        return self.index[wid]["widget"].get("page") or "main"

    def _set_pos(self, wid: str, pos: dict[str, int]) -> None:
        self.index[wid]["widget"]["position"] = pos
        store.update("dashboard_widgets", wid, {"position": pos})

    def _push_down(self, page: str, y: int, h: int, exclude: Any = None) -> None:
        for other, new_y in make_room(self.index, page, y, h, exclude):
            self._set_pos(other, {**self.index[other]["widget"]["position"], "y": new_y})

    def _put(self, w: dict[str, Any], page: str, place: Any, exclude: str | None = None, size: dict[str, int] | None = None) -> dict[str, int]:
        """Position on `page` at `place` (fills a gap when it fits, else pushes the widgets below down)."""
        pos = dict(size) if size else _layout([w], 0)[0]
        pos["y"] = anchor_y(self.index, page, place, exclude)
        self._push_down(page, pos["y"], pos["h"], exclude)
        return pos

    def _register(self, wid: str, page: str, pos: dict[str, int], name: str, spec: dict[str, Any], sql: str) -> None:
        self.index[wid] = {"widget": {"id": wid, "page": page, "position": pos}, "chart": {"name": name, "spec": spec}, "sql": sql}
        self.changed_ids.append(wid)
        self.touched = page

    def _need(self, wid: str) -> dict[str, Any]:
        if wid not in self.index:
            raise ValueError("unknown widget id")
        return self.index[wid]

    def apply(self, op: dict[str, Any]) -> str:
        kind = op.get("op")
        handler = getattr(self, f"op_{kind}", None) if isinstance(kind, str) and kind.isidentifier() else None
        if not handler:
            raise ValueError(f"unknown operation {kind!r}")
        return handler(op, str(op.get("id", "")))

    def op_remove(self, op: dict, wid: str) -> str:
        cur = self._need(wid)
        store.delete("dashboard_widgets", wid)
        self.touched = self._page_of(wid)
        del self.index[wid]
        return f'removed "{cur["chart"]["name"]}"'

    def op_add(self, op: dict, wid: str) -> str:
        spec = op.get("widget") if isinstance(op.get("widget"), dict) else None
        if not spec:
            raise ValueError("add without a widget")
        w = _materialize(spec, self.context, self.provider_id)
        page = self.aliases.get(str(spec.get("page")), spec.get("page"))
        target = page if page in self.page_name else self.viewing
        pos = self._put(w, target, spec.get("place") or op.get("place"))
        new = _store_widget(self.dash["id"], w, pos, None, target)
        self._register(new["id"], target, pos, w["title"], w["chart"], w["sql"])
        fixes = f' ({"; ".join(w["notes"])})' if w.get("notes") else ""
        return f'added "{w["title"]}" ({w["chart"]["type"]}) on {self.page_name[target]}{fixes}'

    def op_update(self, op: dict, wid: str) -> str:
        cur = self._need(wid)
        where = self._page_of(wid)
        spec = {"title": op.get("title") or cur["chart"]["name"], "type": op.get("type") or cur["chart"]["spec"]["type"], "sql": op.get("sql") or cur["sql"]}
        w = _materialize(spec, self.context, self.provider_id)
        # a new chart, not an in-place edit: the old one may be shared with other dashboards; the widget keeps its page and place
        pos = cur["widget"].get("position") or self._put(w, where, "bottom")
        new = _store_widget(self.dash["id"], w, pos, None, where)
        store.delete("dashboard_widgets", wid)
        del self.index[wid]
        self._register(new["id"], where, pos, w["title"], w["chart"], w["sql"])
        fixes = f' ({"; ".join(w["notes"])})' if w.get("notes") else ""
        return f'updated "{w["title"]}" ({new["type"]}){fixes}'

    def op_move(self, op: dict, wid: str) -> str:
        cur = self._need(wid)
        where = self._page_of(wid)
        self._set_pos(wid, self._put({}, where, op.get("place"), exclude=wid, size=cur["widget"].get("position")))
        self.touched = where
        return f'moved "{cur["chart"]["name"]}"'

    def op_arrange(self, op: dict, wid: str) -> str:
        ids = [str(i) for i in op.get("ids", []) if str(i) in self.index] if isinstance(op.get("ids"), list) else []
        if not ids:   # default: every KPI of the page being viewed
            ids = [i for i, e in self.index.items() if (e["widget"].get("page") or "main") == self.viewing and e["chart"].get("spec", {}).get("type") == "kpi"]
        if not ids:
            raise ValueError("no widgets to arrange")
        where = self._page_of(ids[0])
        pos = lambda i: self.index[i]["widget"].get("position") or {}   # noqa: E731
        ids.sort(key=lambda i: (pos(i).get("y", 0), pos(i).get("x", 0)))
        cols = min(max(int(op.get("columns") or 4), 1), 6)
        base = min(pos(i).get("y", 0) for i in ids)
        cells = grid_positions(len(ids), cols, base)
        self._push_down(where, base, max(c["y"] + c["h"] for c in cells) - base, exclude=set(ids))   # anything in the way moves below
        for i, cell in zip(ids, cells):
            self._set_pos(i, cell)
        self.touched = where
        return f"arranged {len(ids)} widgets in rows of {cols}"

    def op_resize(self, op: dict, wid: str) -> str:
        cur = self._need(wid)
        pos = dict(cur["widget"].get("position") or {"x": 0, "y": 0, "w": 6, "h": 4})
        pos["w"] = min(max(int(op.get("w") or pos["w"]), 1), 12)
        pos["h"] = min(max(int(op.get("h") or pos["h"]), 1), 12)
        pos["x"] = min(pos["x"], 12 - pos["w"])
        self._set_pos(wid, pos)
        self.touched = self._page_of(wid)
        return f'resized "{cur["chart"]["name"]}" to {pos["w"]}x{pos["h"]}'

    def op_note(self, op: dict, wid: str) -> str:
        content = str(op.get("content") or "").strip()
        if not content:
            raise ValueError("empty note")
        target = op.get("page") if op.get("page") in self.page_name else self.viewing
        size = {"x": 0, "y": 0, "w": 12, "h": max(2, min(6, content.count("\n") + 2))}
        pos = self._put({}, target, op.get("place"), size=size)
        row = store.insert("dashboard_widgets", {"dashboard_id": self.dash["id"], "kind": "text", "title": str(op.get("title") or "Notes")[:80],
                                                 "page": target, "position": pos, "settings": {"content": content}})
        self._register(row["id"], target, pos, row["title"], {"type": "text"}, "")
        return f"added a note on {self.page_name[target]}"

    def op_rename(self, op: dict, wid: str) -> str:
        name = str(op.get("name") or "").strip()[:80]
        if not name:
            raise ValueError("no new name")
        store.update("dashboards", self.dash["id"], {"name": name})
        self.dash["name"] = name
        return f'renamed the dashboard to "{name}"'

    def op_add_page(self, op: dict, wid: str) -> str:
        name = str(op.get("name") or "").strip()[:40] or "New page"
        pid = re.sub(r"[^a-z0-9]+", "_", str(op.get("id") or name).lower()).strip("_") or "page"
        while pid in self.page_name:
            pid += "_2"
        self.aliases[str(op.get("id") or name)] = pid
        self.pages.append({"id": pid, "name": name})
        store.update("dashboards", self.dash["id"], {"pages": self.pages})
        self.viewing = self.touched = pid   # the widgets that follow go on the new page unless they name another
        return f'added page "{name}"'
