const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connect, JSONCodec } = require('nats');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const sc = JSONCodec();

const PORT = 3005;
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

let natsConn;

// 5 Virtual Devices
const devices = [
    { id: 'HC-IOT-001', name: 'Main Vaccine Fridge', temp: 4.2, active: true },
    { id: 'HC-IOT-002', name: 'Blood Bank Alpha', temp: 3.8, active: true },
    { id: 'HC-IOT-003', name: 'Pharmacy Lab B', temp: 21.5, active: false },
    { id: 'HC-IOT-004', name: 'Surgical Store 1', temp: 18.2, active: false },
    { id: 'HC-IOT-005', name: 'Emergency Cold Box', temp: 5.1, active: true }
];

async function initNats() {
    try {
        natsConn = await connect({ servers: NATS_URL });
        console.log(`✅ Connected to NATS at ${NATS_URL}`);
    } catch (err) {
        console.error(`❌ NATS Connection failed: ${err.message}`);
    }
}

// Emit Telemetry loop
setInterval(() => {
    if (!natsConn) return;

    devices.filter(d => d.active).forEach(device => {
        // Subtle drift
        device.temp += (Math.random() - 0.5) * 0.2;
        
        const payload = {
            device_id: device.id,
            temperature: parseFloat(device.temp.toFixed(2)),
            timestamp: new Date().toISOString()
        };

        natsConn.publish(`iot.telemetry.${device.id}`, sc.encode(payload));
        console.log(`📡 Emitted: ${device.id} -> ${payload.temperature}°C`);
    });

    io.emit('device_update', devices);
}, 5000);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.emit('device_update', devices);

    socket.on('toggle_device', (id) => {
        const d = devices.find(dev => dev.id === id);
        if (d) d.active = !d.active;
        io.emit('device_update', devices);
    });

    socket.on('set_temp', ({ id, temp }) => {
        const d = devices.find(dev => dev.id === id);
        if (d) d.temp = parseFloat(temp);
        io.emit('device_update', devices);
    });
});

initNats().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 IoT Simulator running at http://localhost:${PORT}`);
    });
});
