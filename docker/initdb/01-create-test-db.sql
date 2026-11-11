CREATE DATABASE siber_test;
-- Autocuración de conexiones zombie en la DB de pruebas: mata sesiones que
-- lleven >10s sin ejecutar nada dentro de una transacción abierta.
ALTER DATABASE siber_test SET idle_in_transaction_session_timeout = '10s';
