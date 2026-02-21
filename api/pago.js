export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { modelo, precio, nombre, telefono } = req.body;
    if (!modelo || !precio) {
      return res.status(400).json({ error: 'Faltan datos: modelo y precio son requeridos' });
    }

    // Precio sin markup
    const precioBase = parseFloat(precio);
    const precioFinal = Math.round(precioBase);

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    }

    // Crear preferencia de pago en Mercado Pago
    const preference = {
      items: [{
        title: `Reserva Plan VW ${modelo}`,
        description: `Reserva de plan de ahorro Volkswagen ${modelo} — ALRA Planes`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: precioFinal
      }],
      payer: {
        name: nombre || '',
        phone: { number: telefono || '' }
      },
      back_urls: {
        success: 'https://alraplanesvw.com.ar?pago=ok',
        failure: 'https://alraplanesvw.com.ar?pago=error',
        pending: 'https://alraplanesvw.com.ar?pago=pendiente'
      },
      auto_return: 'approved',
      external_reference: `alra_${modelo.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      notification_url: 'https://api.crmalluma.com.ar/api/webhooks/pagina-alra',
      statement_descriptor: 'ALRA PLANES VW',
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('MP Error:', mpData);
      return res.status(500).json({ error: 'Error al crear el pago', detail: mpData });
    }

    return res.status(200).json({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      precio_final: precioFinal
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
