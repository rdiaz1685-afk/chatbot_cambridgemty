// Script de prueba para generar ficha de pago
const fs = require('fs');

async function testGenerarFicha() {
  try {
    console.log('🧪 Iniciando prueba de generación de ficha...');
    
    const testData = {
      action: 'generar_ficha',
      curp: 'ROPA120807MNLDBLA9',
      campus: 'Norte',

      // ✅ Usa el concepto TAL CUAL aparece en el chat después del estado de cuenta:

      // Colegiatura → selecciona "Abril" en el dropdown
      // conceptoId: 'COLEGIATURA DE ABRIL 25-26',

      // Danza → selecciona "Clases Extrac-Abril"
      conceptoId: 'DANZA - MENSUALIDAD DE ABRIL',

      // Ajedrez → selecciona "Clases Extrac-Abril"
      // conceptoId: 'AJEDREZ - MENSUALIDAD DE ABRIL',

      // Danza de Marzo → selecciona "Clases Extrac-Marzo"
      // conceptoId: 'DANZA - MENSUALIDAD DE MARZO',
    };

    console.log('📤 Enviando solicitud:', testData);

    const response = await fetch('http://localhost:3000/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('📥 Respuesta:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    console.log('Data:', result.data);
    console.log('Error:', result.error);

    if (result.success && result.data?.fichaPago?.fileUrl) {
      console.log('✅ Ficha generada exitosamente!');
      const downloadUrl = `http://localhost:3000${result.data.fichaPago.fileUrl}`;
      const downloadResponse = await fetch(downloadUrl);
      if (downloadResponse.ok) {
        const buffer = await downloadResponse.arrayBuffer();
        fs.writeFileSync('./test_ficha_descargada.pdf', Buffer.from(buffer));
        console.log('✅ PDF guardado como test_ficha_descargada.pdf');
      }
    } else {
      console.log('❌ Falló la generación');
      if (result.error) console.log('🔍 Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGenerarFicha();
