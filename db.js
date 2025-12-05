const sql = require('mssql');

const dbSettings = {
    user: 'IsaacDBR_SQLLogin_2',      
    // AQUÍ ESTÁ EL CAMBIO: Lee la variable que creaste en Render
    password: process.env.DB_PASSWORD, 
    server: 'RamonBetetaDB.mssql.somee.com', 
    database: 'RamonBetetaDB',        
    options: {
        encrypt: false, 
        trustServerCertificate: true 
    }
};

async function getConnection() {
    try {
        const pool = await sql.connect(dbSettings);
        return pool;
    } catch (error) {
        console.error('ERROR CONECTANDO A BD:', error);
        throw error; // ESTO ES VITAL para que no falle el login
    }
}

module.exports = { getConnection, sql };