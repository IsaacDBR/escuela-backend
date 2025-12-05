const sql = require('mssql');

const dbSettings = {
    user: 'IsaacDBR_SQLLogin_2',      // Dato tomado de tu imagen
    password: 'BetetaRamon54', // <--- Escribe aquí la que acabas de crear en Somee
    server: 'RamonBetetaDB.mssql.somee.com', // Dato tomado de tu imagen
    database: 'RamonBetetaDB',        // Dato tomado de tu imagen
    options: {
        encrypt: false, 
        trustServerCertificate: true // Importante para Somee
    }
};

async function getConnection() {
    try {
        const pool = await sql.connect(dbSettings);
        return pool;
    } catch (error) {
        console.error('Error conectando a la BD:', error);
    }
}

module.exports = { getConnection, sql };