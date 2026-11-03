-- Runs once, when the dev Postgres container first starts on an empty volume.
-- POSTGRES_DB creates issues_dev, and this adds the databases the tests use.
CREATE DATABASE issues_test;
CREATE DATABASE issues_test_e2e;
