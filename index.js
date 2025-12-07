const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 
const multer = require('multer'); 
const { getConnection, sql } = require('./db');

const app = express();

// --- CONFIGURACIÓN DE MULTER (SUBIDA DE ARCHIVOS) ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_')); 
    }
});

const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pagina inicio logo.html'));
});

// ================= LOGIN UNIFICADO =================
app.post('/api/login', async (req, res) => {
    console.log("Login:", req.body);
    const { usuario, password } = req.body;
    
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('user', sql.VarChar, usuario)
            .input('pass', sql.VarChar, password)
            .query('SELECT * FROM Usuarios WHERE Correo_Usuario = @user AND Contraseña_Usuario = @pass AND Activo = 1');

        if (result.recordset.length === 0) {
            return res.json({ success: false, msg: 'Usuario o contraseña incorrectos' });
        }

        const user = result.recordset[0];
        let nombre = 'Usuario';

        if (user.Rol_Usuario === 'Docente') {
            const r = await pool.request().input('id', sql.Int, user.ID_Usuario).query('SELECT Nombre_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
            if(r.recordset.length > 0) nombre = r.recordset[0].Nombre_Docente;
        } else if (user.Rol_Usuario === 'Tutor') {
            const r = await pool.request().input('id', sql.Int, user.ID_Usuario).query('SELECT Nombre_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
            if(r.recordset.length > 0) nombre = r.recordset[0].Nombre_Tutor;
        } else if (user.Rol_Usuario === 'Directivo') {
            const r = await pool.request().input('id', sql.Int, user.ID_Usuario).query('SELECT Nombre_Directivo FROM Directivos WHERE ID_DirecUsuario = @id');
            if(r.recordset.length > 0) nombre = r.recordset[0].Nombre_Directivo;
        }

        res.json({ success: true, id: user.ID_Usuario, nombre: nombre, rol: user.Rol_Usuario });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ msg: 'Error server' }); 
    }
});

// ================= DOCENTE (CORREGIDO) =================

app.get('/api/docente/alumnos/:idUsuario', async (req, res) => {
    try {
        const pool = await getConnection();
        const docRes = await pool.request().input('id', sql.Int, req.params.idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
        if(docRes.recordset.length === 0) return res.json([]);
        
        const result = await pool.request().input('idDoc', sql.Int, docRes.recordset[0].ID_Docente)
            .query('SELECT A.ID_Alumno, A.Nombre_Alumno, G.Letra_Grupo FROM Alumnos A INNER JOIN Grupo G ON A.ID_AlumnoGrupo = G.ID_Grupo WHERE G.ID_GrupoDocente = @idDoc');
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/api/docente/calificar', async (req, res) => {
    try {
        const pool = await getConnection();
        const docRes = await pool.request().input('id', sql.Int, req.body.idDocente).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
        const idDocReal = docRes.recordset[0].ID_Docente;

        await pool.request()
            .input('c', sql.Decimal(4,2), req.body.calificacion).input('p', sql.VarChar, req.body.parcial)
            .input('idA', sql.Int, req.body.idAlumno).input('idM', sql.Int, req.body.idMateria).input('idD', sql.Int, idDocReal)
            .query('INSERT INTO Calificaciones (Calificacion, Parcial_Calf, ID_CalfAlumno, ID_CalfMateria, ID_CalfDocente) VALUES (@c, @p, @idA, @idM, @idD)');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.post('/api/docente/aviso', async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('t', sql.VarChar, req.body.titulo).input('c', sql.Text, req.body.contenido)
            .input('idU', sql.Int, req.body.idUsuario)
            .query('INSERT INTO Avisos (Titulo_Aviso, Contenido_Aviso, ID_AvisoUsuario, Fecha_Publicacion) VALUES (@t, @c, @idU, GETDATE())');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.post('/api/docente/asistencia', async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('f', sql.Date, req.body.fecha).input('e', sql.VarChar, req.body.estado).input('idA', sql.Int, req.body.idAlumno)
            .query('INSERT INTO Asistencias (Fecha_Asist, Estado_Asist, ID_AsistAlumno) VALUES (@f, @e, @idA)');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.post('/api/docente/observacion', async (req, res) => {
    try {
        const pool = await getConnection();
        const docRes = await pool.request().input('id', sql.Int, req.body.idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
        const idDocReal = docRes.recordset[0].ID_Docente;

        await pool.request()
            .input('t', sql.VarChar, req.body.titulo).input('d', sql.Text, req.body.descripcion).input('f', sql.DateTime, req.body.fecha)
            .input('idA', sql.Int, req.body.idAlumno).input('idD', sql.Int, idDocReal)
            .query('INSERT INTO Observaciones (Titulo_Obsserv, Descripcion_Ob, Fecha_Observ, ID_ObsAlumno, ID_ObsDocente) VALUES (@t, @d, @f, @idA, @idD)');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

// SUBIR EVIDENCIA (CON ARCHIVO)
app.post('/api/docente/evidencia', upload.single('archivo'), async (req, res) => {
    try {
        const { titulo, descripcion, idAlumno, idMateria } = req.body;
        const archivoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const idAlum = (idAlumno === 'all' || idAlumno === '') ? null : idAlumno;

        const pool = await getConnection();
        await pool.request()
            .input('t', sql.VarChar, titulo)
            .input('d', sql.VarChar, descripcion)
            .input('url', sql.VarChar, archivoUrl)
            .input('idA', sql.Int, idAlum)
            .input('idM', sql.Int, idMateria)
            .query(`INSERT INTO Evidencias (Titulo_Evidencia, Descripcion_Evid, Fecha_EvidSubida, ID_EvidMateria, Estado_Evidencia, Archivo_EvidUrl, ID_EvidAlumno) 
                    VALUES (@t, @d, GETDATE(), @idM, 'Pendiente', @url, @idA)`);
        
        res.json({ success: true });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ msg: error.message }); 
    }
});

// Citas Pendientes
app.get('/api/docente/citas-pendientes/:idUsuario', async (req, res) => {
    try {
        const pool = await getConnection();
        const docRes = await pool.request().input('id', sql.Int, req.params.idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
        if (docRes.recordset.length === 0) return res.json([]);
        const idDoc = docRes.recordset[0].ID_Docente;

        const result = await pool.request().input('idD', sql.Int, idDoc)
            .query(`SELECT C.ID_Cita, C.FechaSolicitud_Cita, C.HoraSolicitada_Cita, C.Motivo_Cita, T.Nombre_Tutor 
                    FROM Citas C INNER JOIN Tutores T ON C.ID_CitaTutor = T.ID_Tutor 
                    WHERE C.ID_CitaDocente = @idD AND C.Estado_Cita = 'Pendiente'`);
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.put('/api/docente/responder-cita', async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('idCita', sql.Int, req.body.idCita).input('estado', sql.VarChar, req.body.estado)
            .input('fecha', sql.Date, req.body.fecha || null).input('hora', sql.Time, req.body.hora || null)
            .query(`UPDATE Citas SET Estado_Cita = @estado, FechaConfirmada_Cita = @fecha, HoraConfirmada_Cita = @hora WHERE ID_Cita = @idCita`);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.get('/api/docente/tutores/:idUsuario', async (req, res) => {
    try {
        const pool = await getConnection();
        const docRes = await pool.request().input('id', sql.Int, req.params.idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
        const idDoc = docRes.recordset[0].ID_Docente;
        const result = await pool.request().input('idD', sql.Int, idDoc)
            .query(`SELECT DISTINCT T.ID_Tutor, T.Nombre_Tutor, A.Nombre_Alumno FROM Tutores T JOIN Alumnos A ON A.ID_AlumnoTutor = T.ID_Tutor JOIN Grupo G ON A.ID_AlumnoGrupo = G.ID_Grupo WHERE G.ID_GrupoDocente = @idD`);
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

// ================= TUTOR =================

app.get('/api/tutor/hijos/:idUsuario', async (req, res) => {
    try {
        const pool = await getConnection();
        const tRes = await pool.request().input('id', sql.Int, req.params.idUsuario).query('SELECT ID_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
        if(tRes.recordset.length === 0) return res.json([]);
        
        const result = await pool.request().input('idT', sql.Int, tRes.recordset[0].ID_Tutor)
            .query('SELECT ID_Alumno, Nombre_Alumno FROM Alumnos WHERE ID_AlumnoTutor = @idT');
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.get('/api/alumno/calificaciones/:idAlumno', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().input('id', sql.Int, req.params.idAlumno)
            .query('SELECT M.Nombre_Materia, C.Parcial_Calf, C.Calificacion FROM Calificaciones C INNER JOIN Materia M ON C.ID_CalfMateria = M.ID_Materia WHERE C.ID_CalfAlumno = @id');
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.get('/api/avisos', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.query(`SELECT TOP 10 * FROM Avisos WHERE Fecha_Publicacion >= DATEADD(day, -7, GETDATE()) ORDER BY Fecha_Publicacion DESC`);
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.get('/api/alumno/asistencias/:idAlumno', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().input('id', sql.Int, req.params.idAlumno)
            .query('SELECT * FROM Asistencias WHERE ID_AsistAlumno = @id ORDER BY Fecha_Asist DESC');
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.get('/api/alumno/observaciones/:idAlumno', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().input('id', sql.Int, req.params.idAlumno)
            .query('SELECT * FROM Observaciones WHERE ID_ObsAlumno = @id ORDER BY Fecha_Observ DESC');
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.get('/api/evidencias', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.query("SELECT TOP 5 * FROM Evidencias WHERE Estado_Evidencia = 'Validado' ORDER BY Fecha_EvidSubida DESC");
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/api/tutor/cita', async (req, res) => {
    try {
        const pool = await getConnection();
        const tRes = await pool.request().input('id', sql.Int, req.body.idUsuario).query('SELECT ID_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
        const idTutor = tRes.recordset[0].ID_Tutor;

        const docRes = await pool.request().input('idT', sql.Int, idTutor).query(`SELECT TOP 1 G.ID_GrupoDocente FROM Alumnos A INNER JOIN Grupo G ON A.ID_AlumnoGrupo = G.ID_Grupo WHERE A.ID_AlumnoTutor = @idT`);
        if(docRes.recordset.length === 0) return res.json({ success: false, msg: "No se encontró docente asignado" });
        const idDocente = docRes.recordset[0].ID_GrupoDocente;

        await pool.request()
            .input('f', sql.Date, req.body.fecha).input('h', sql.VarChar, req.body.hora).input('m', sql.VarChar, req.body.motivo)
            .input('idT', sql.Int, idTutor).input('idD', sql.Int, idDocente)
            .query("INSERT INTO Citas (FechaSolicitud_Cita, HoraSolicitada_Cita, Motivo_Cita, ID_CitaTutor, ID_CitaDocente, Estado_Cita) VALUES (@f, @h, @m, @idT, @idD, 'Pendiente')");
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.get('/api/tutor/mis-citas/:idUsuario', async (req, res) => {
    try {
        const pool = await getConnection();
        const tRes = await pool.request().input('id', sql.Int, req.params.idUsuario).query('SELECT ID_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
        const idTutor = tRes.recordset[0].ID_Tutor;

        const result = await pool.request().input('idT', sql.Int, idTutor)
            .query(`SELECT C.*, D.Nombre_Docente FROM Citas C INNER JOIN Docentes D ON C.ID_CitaDocente = D.ID_Docente WHERE C.ID_CitaTutor = @idT ORDER BY C.FechaSolicitud_Cita DESC`);
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.put('/api/tutor/cancelar-cita', async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request().input('id', sql.Int, req.body.idCita).query("UPDATE Citas SET Estado_Cita = 'Cancelada' WHERE ID_Cita = @id");
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

// ================= CHAT (CORREGIDO CON LOGICA WHATSAPP) =================
app.post('/api/chat/mensajes', async (req, res) => {
    try {
        const { idUsuario, rol } = req.body;
        const pool = await getConnection();
        let query = "";
        let idActor = 0;

        if (rol === 'Docente') {
            const r = await pool.request().input('id', sql.Int, idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
            idActor = r.recordset[0].ID_Docente;
            query = `SELECT M.*, T.Nombre_Tutor as OtroParticipante FROM Mensajes M JOIN Tutores T ON M.ID_MnsjTutor = T.ID_Tutor WHERE ID_MnsjDocente = @idActor ORDER BY Fecha_Mnsj ASC`;
        } else {
            const r = await pool.request().input('id', sql.Int, idUsuario).query('SELECT ID_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
            idActor = r.recordset[0].ID_Tutor;
            query = `SELECT M.*, D.Nombre_Docente as OtroParticipante FROM Mensajes M JOIN Docentes D ON M.ID_MnsjDocente = D.ID_Docente WHERE ID_MnsjTutor = @idActor ORDER BY Fecha_Mnsj ASC`;
        }
        
        const msgs = await pool.request().input('idActor', sql.Int, idActor).query(query);
        res.json(msgs.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/api/chat/enviar', async (req, res) => {
    try {
        const { contenido, idUsuario, rol, idDestinatario } = req.body; 
        const pool = await getConnection();
        let idTutor = 0; let idDocente = 0;
        let enviadoPor = rol; // Nuevo campo

        if (rol === 'Tutor') {
            const t = await pool.request().input('id', sql.Int, idUsuario).query('SELECT ID_Tutor FROM Tutores WHERE ID_TutorUsuario = @id');
            idTutor = t.recordset[0].ID_Tutor;
            if(!idDestinatario) {
                const doc = await pool.request().input('idT', sql.Int, idTutor).query('SELECT TOP 1 G.ID_GrupoDocente FROM Alumnos A JOIN Grupo G ON A.ID_AlumnoGrupo = G.ID_Grupo WHERE A.ID_AlumnoTutor = @idT');
                idDocente = doc.recordset.length > 0 ? doc.recordset[0].ID_GrupoDocente : 1; 
            } else { idDocente = idDestinatario; }
        } else {
            const d = await pool.request().input('id', sql.Int, idUsuario).query('SELECT ID_Docente FROM Docentes WHERE ID_DocenteUsuario = @id');
            idDocente = d.recordset[0].ID_Docente;
            idTutor = idDestinatario; 
        }

        // Se agregó la columna EnviadoPor
        await pool.request()
            .input('cont', sql.Text, contenido).input('idT', sql.Int, idTutor).input('idD', sql.Int, idDocente).input('env', sql.VarChar, enviadoPor)
            .query('INSERT INTO Mensajes (Contenido_Mnsj, Fecha_Mnsj, ID_MnsjTutor, ID_MnsjDocente, EnviadoPor) VALUES (@cont, GETDATE(), @idT, @idD, @env)');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

// ================= DIRECTIVO (RESTAURADO) =================
app.post('/api/directivo/alumno', async (req, res) => {
    const { matricula, nombre, grado, grupo } = req.body;
    try {
        const pool = await getConnection();
        const grupoRes = await pool.request().input('nGrado', sql.VarChar, grado).input('lGrupo', sql.VarChar, grupo)
            .query(`SELECT G.ID_Grupo FROM Grupo G INNER JOIN Grado GR ON G.ID_GrupoGrado = GR.ID_Grado WHERE GR.Nombre_Grado = @nGrado AND G.Letra_Grupo = @lGrupo`);

        if (grupoRes.recordset.length === 0) return res.json({ success: false, msg: `No existe el Grado "${grado}" con Grupo "${grupo}".` });
        const idGrupo = grupoRes.recordset[0].ID_Grupo;
        
        await pool.request().input('mat', sql.VarChar, matricula).input('nom', sql.VarChar, nombre).input('idG', sql.Int, idGrupo)
            .query(`INSERT INTO Alumnos (Matricula, Nombre_Alumno, ID_AlumnoGrupo, Activo) VALUES (@mat, @nom, @idG, 1)`);
        res.json({ success: true, msg: 'Alumno registrado correctamente' });
    } catch (error) { res.status(500).json({ success: false, msg: error.message }); }
});

app.put('/api/directivo/alumno/desactivar', async (req, res) => {
    const { matricula } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request().input('mat', sql.VarChar, matricula).query("UPDATE Alumnos SET Activo = 0 WHERE Matricula = @mat");
        if(result.rowsAffected[0] > 0) res.json({ success: true, msg: 'Alumno desactivado' });
        else res.json({ success: false, msg: 'Matrícula no encontrada' });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.put('/api/directivo/usuario/desactivar', async (req, res) => {
    const { criterio } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request().input('crit', sql.VarChar, criterio).query("UPDATE Usuarios SET Activo = 0 WHERE Correo_Usuario = @crit OR CAST(ID_Usuario AS VARCHAR) = @crit");
        if(result.rowsAffected[0] > 0) res.json({ success: true, msg: 'Usuario desactivado correctamente' });
        else res.json({ success: false, msg: 'Usuario no encontrado' });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.get('/api/directivo/validaciones', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.query(`
            SELECT E.ID_Evidencia, E.Titulo_Evidencia, E.Descripcion_Evid, E.Archivo_EvidUrl, 
                   A.Nombre_Alumno, G.Letra_Grupo, M.Nombre_Materia
            FROM Evidencias E
            LEFT JOIN Alumnos A ON E.ID_EvidAlumno = A.ID_Alumno
            LEFT JOIN Grupo G ON A.ID_AlumnoGrupo = G.ID_Grupo
            LEFT JOIN Materia M ON E.ID_EvidMateria = M.ID_Materia
            WHERE E.Estado_Evidencia = 'Pendiente'
        `);
        res.json(result.recordset);
    } catch (error) { res.status(500).send(error.message); }
});

app.put('/api/directivo/validar', async (req, res) => {
    const { idEvidencia, estado } = req.body;
    try {
        const pool = await getConnection();
        await pool.request().input('id', sql.Int, idEvidencia).input('st', sql.VarChar, estado)
            .query("UPDATE Evidencias SET Estado_Evidencia = @st WHERE ID_Evidencia = @id");
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

app.post('/api/directivo/aviso', async (req, res) => {
    try {
        const pool = await getConnection();
        await pool.request().input('t', sql.VarChar, req.body.titulo).input('c', sql.Text, req.body.contenido).input('idU', sql.Int, req.body.idUsuario)
            .query('INSERT INTO Avisos (Titulo_Aviso, Contenido_Aviso, ID_AvisoUsuario, Fecha_Publicacion, ID_AvisoGrupo) VALUES (@t, @c, @idU, GETDATE(), NULL)');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ msg: error.message }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));