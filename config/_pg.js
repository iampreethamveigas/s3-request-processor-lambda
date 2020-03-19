const pg = require('pg')
const { Pool } = require('pg');

/*
The pool configuration for pg connection
*/
const pool = new Pool({
    host: process.env.db_host,
    user: process.env.db_user,
    max: process.env.db_max,
    idleTimeoutMillis: process.env.db_idle_timeout,
    connectionTimeoutMillis: process.env.db_connection_timeout,
})

module.exports = { pg, pool }
