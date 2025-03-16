from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker, declarative_base
from sqlalchemy.ext.declarative import declared_attr

from core.config import settings


class DefaultTableName:
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI.unicode_string())
Session = sessionmaker(engine)
# inspector = inspect(engine)
Base = declarative_base(cls=DefaultTableName)


def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
