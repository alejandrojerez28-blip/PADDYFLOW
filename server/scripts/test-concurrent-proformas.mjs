#!/usr/bin/env node
/**
 * Prueba de concurrencia: crear 20 proformas en paralelo.
 * Verifica que todos los números sean únicos.
 *
 * Uso:
 *   1. Servidor corriendo en localhost:3001
 *   2. Tener un tenant y token válido
 *   3. node server/scripts/test-concurrent-proformas.mjs <TOKEN>
 */
const API = 'http://localhost:3001/api';
const token = process.argv[2];
if (!token) {
  console.error('Uso: node test-concurrent-proformas.mjs <JWT_TOKEN>');
  process.exit(1);
}

const payload = {
  currency: 'DOP',
  items: [{ itemName: 'Test', qty: 1, unitPrice: 100, itbisRate: 0 }],
};

async function createProforma() {
  const res = await fetch(`${API}/sales/proformas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, internalNumber: data?.internalNumber, id: data?.id };
}

async function main() {
  console.log('Creando 20 proformas en paralelo...');
  const start = Date.now();
  const results = await Promise.all(Array.from({ length: 20 }, () => createProforma()));
  const elapsed = Date.now() - start;

  const numbers = results.map((r) => r.internalNumber).filter(Boolean);
  const unique = new Set(numbers);
  const failed = results.filter((r) => r.status !== 201);

  console.log(`\nCompletado en ${elapsed}ms`);
  console.log(`Exitosos: ${numbers.length}/20`);
  console.log(`Fallidos: ${failed.length}`);
  console.log(`Números únicos: ${unique.size}/${numbers.length}`);

  if (numbers.length > 0) {
    console.log('\nNúmeros generados:', numbers.sort());
  }

  if (unique.size !== numbers.length) {
    console.error('\nERROR: Se detectaron números duplicados');
    process.exit(1);
  }
  if (failed.length > 0) {
    console.error('Algunas requests fallaron:', failed);
    process.exit(1);
  }
  console.log('\nOK: Todos los números son únicos');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
