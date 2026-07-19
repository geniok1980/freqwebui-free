FROM python:3.11-slim

WORKDIR /docs

RUN pip install --no-cache-dir \
    mkdocs \
    mkdocs-material \
    mkdocs-material-extensions \
    pymdown-extensions

EXPOSE 8000

COPY mkdocs.yml .
COPY docs/ ./docs/

CMD ["mkdocs", "serve", "-a", "0.0.0.0:8000"]
