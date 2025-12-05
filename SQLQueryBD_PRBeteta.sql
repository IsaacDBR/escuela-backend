-- Actualizar Directivo
UPDATE Usuarios 
SET Correo_Usuario = 'directivo', Contraseña_Usuario = 'dic123' 
WHERE Rol_Usuario = 'Directivo';

-- Actualizar Docente (Juan Perez)
UPDATE Usuarios 
SET Correo_Usuario = 'juanperez', Contraseña_Usuario = 'doc123' 
WHERE Rol_Usuario = 'Docente';

-- Actualizar Tutor (Maria Garcia)
UPDATE Usuarios 
SET Correo_Usuario = 'mariagarcia', Contraseña_Usuario = 'tut123' 
WHERE Rol_Usuario = 'Tutor';

-- Verificar cómo quedaron
SELECT * FROM Usuarios;