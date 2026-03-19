import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { InnovatAgent } from '../src/lib/automation/innovat-agent';
import fs from 'fs';

async function main() {
  const agent = new InnovatAgent();
  const campus = 'CUMBRES';
  const curp = 'GOCB110217HNLNRNA9';
  console.log(`===== TEST LOCAL AGENTE INNOVAT =====`);
  console.log(`Buscando Curp: ${curp} en Campus: ${campus}`);

  try {
    const res = await agent.generarFichaPago(curp, campus);
    fs.writeFileSync('test_out.json', JSON.stringify(res, null, 2));
    console.log('Finalizado, guardado en test_out.json');
  } catch(e) {
    console.error('Error Crítico:', e);
  }
}

main();
