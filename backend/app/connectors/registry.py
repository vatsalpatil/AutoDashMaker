from .base import DataConnector
from .files import FileConnector
from .postgres import PostgresConnector
from .rest import GraphQLConnector, RestConnector
from .mysql import MySQLConnector
from .sqlite import SQLiteConnector
from .web import UrlConnector

CONNECTOR_TYPES = {
    "file": FileConnector,
    "postgres": PostgresConnector,
    "mysql": MySQLConnector,
    "sqlite": SQLiteConnector,
    "rest": RestConnector,
    "graphql": GraphQLConnector,
    "url": UrlConnector,
    "gsheets": UrlConnector,   # same downloader; auto-detects the sheet link
}


def get_connector(source_type: str, config: dict) -> DataConnector:
    cls = CONNECTOR_TYPES.get(source_type)
    if not cls:
        raise ValueError(f"unknown connector type: {source_type}")
    return cls(config)
