from sqlalchemy import create_engine, Column, Integer
from sqlalchemy.orm import Session, sessionmaker, declarative_base
from sqlalchemy.ext.declarative import declared_attr

from core.config import settings


class DefaultTable:
    id = Column(Integer, primary_key=True, index=True)

    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()


engine = create_engine(settings.SQLALCHEMY_DATABASE_URI.unicode_string())
Session = sessionmaker(engine)
# inspector = inspect(engine)
Base = declarative_base(cls=DefaultTable)


def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
