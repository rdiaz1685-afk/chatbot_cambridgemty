const fs = require('fs');
let file = fs.readFileSync('src/lib/automation/innovat-agent.ts', 'utf8');

// Optimización brutal de tiempos de espera para evitar el timeout de Vercel (15s/60s).
// Cambiamos tiempos estáticos largos por cortos (gracia de post-render). 
// Las esperas de Playwright automáticas ya cubren el tiempo de DOMContentLoaded.

file = file.replace(/await this\.browser\.wait\((4000|5000|6000)\)/g, 'await this.browser.wait(1200)');
file = file.replace(/await this\.browser\.wait\((2000|2500)\)/g, 'await this.browser.wait(600)');
file = file.replace(/await this\.browser\.wait\((1000|1200|1500)\)/g, 'await this.browser.wait(400)');
file = file.replace(/await this\.browser\.wait\((8000)\)/g, 'await this.browser.wait(2500)');
file = file.replace(/await this\.browser\.wait\((500)\)/g, 'await this.browser.wait(200)');

fs.writeFileSync('src/lib/automation/innovat-agent.ts', file);
console.log('Tiempos de espera optimizados correctamente.');
