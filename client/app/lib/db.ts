import sql from 'mssql';

const db1Config = {
  server: process.env.DB1_SERVER!,
  port: parseInt(process.env.DB1_PORT || '1433'),
  database: process.env.DB1_DATABASE!,
  user: process.env.DB1_USER!,
  password: process.env.DB1_PASSWORD!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const db2Config = {
  server: process.env.DB2_SERVER!,
  port: parseInt(process.env.DB2_PORT || '1433'),
  database: process.env.DB2_DATABASE!,
  user: process.env.DB2_USER!,
  password: process.env.DB2_PASSWORD!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let db1Pool: sql.ConnectionPool | null = null;
let db2Pool: sql.ConnectionPool | null = null;

async function ensureConnection(
  pool: sql.ConnectionPool | null,
  config: sql.config,
  poolName: string
): Promise<sql.ConnectionPool> {
  try {
    // If pool exists and is connected, return it
    if (pool && pool.connected) {
      return pool;
    }
    
    // Close existing pool if it exists but is not connected
    if (pool) {
      try {
        await pool.close();
      } catch (e) {
        console.log(`Ignoring error while closing ${poolName}:`, e);
      }
    }
    
    // Create new pool and connect
    console.log(`Creating new connection pool for ${poolName}`);
    const newPool = new sql.ConnectionPool(config);
    await newPool.connect();
    console.log(`Successfully connected to ${poolName}`);
    
    // Handle connection errors
    newPool.on('error', (err) => {
      console.error(`${poolName} Pool error:`, err);
      if (poolName === 'DB1') {
        db1Pool = null;
      } else {
        db2Pool = null;
      }
    });
    
    return newPool;
  } catch (error) {
    console.error(`Error connecting to ${poolName}:`, error);
    throw error;
  }
}

export async function getDb1() {
  db1Pool = await ensureConnection(db1Pool, db1Config, 'DB1');
  return db1Pool;
}

export async function getDb2() {
  db2Pool = await ensureConnection(db2Pool, db2Config, 'DB2');
  return db2Pool;
}
