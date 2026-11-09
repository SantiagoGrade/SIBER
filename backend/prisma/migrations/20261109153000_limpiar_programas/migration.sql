-- Elimina los programas académicos de ejemplo (los reales se cargarán por
-- seed/migración cuando la institución los defina). Solo se borran los que
-- no tienen asistencias registradas para no romper integridad referencial.
DELETE FROM "ProgramaAcademico" p
WHERE p."nombre" IN ('Licenciatura', 'Administración', 'Contaduría', 'Trabajo Social')
  AND NOT EXISTS (SELECT 1 FROM "Asistencia" a WHERE a."programaAcademicoId" = p.id);
