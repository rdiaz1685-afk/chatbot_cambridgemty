// Script de prueba para consultar estado de cuenta
async function testConsultaCuenta() {
  try {
    console.log('🧪 Iniciando prueba de consulta de estado de cuenta...');
    
    const testData = {
      action: 'consultar_cuenta',
      curp: 'MOGR141020HNERXN09', // CURP de prueba
      campus: 'Mitras'
    };

    console.log('📤 Enviando solicitud:', testData);

    const response = await fetch('http://localhost:3000/api/automation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('📥 Respuesta recibida:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    console.log('Data:', result.data);
    console.log('Error:', result.error);

    if (result.success && result.data?.estadoCuenta?.conceptos) {
      console.log('✅ Consulta exitosa!');
      console.log('📋 Conceptos encontrados:', result.data.estadoCuenta.conceptos.length);
      result.data.estadoCuenta.conceptos.forEach((concepto, i) => {
        console.log(`${i+1}. ${concepto.descripcion} - $${concepto.monto} (${concepto.estado})`);
      });
    } else {
      console.log('❌ La consulta falló');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

// Ejecutar prueba
testConsultaCuenta();
