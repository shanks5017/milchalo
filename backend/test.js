import { searchBusServices } from './services/busLiveService.js';
import fs from 'fs';

async function run() {
    try {
        console.log("Testing bus service: Coimbatore to Bangalore on 25-07-2026...");
        const results = await searchBusServices('Coimbatore', 'Bangalore', '25-07-2026');
        console.log(`\n[*] Found ${results.length} buses.`);
        
        if (results.length > 0) {
            console.log("\n--- SAMPLE BUS ---");
            const sample = results[0];
            console.log(`Operator:    ${sample.travelerAgentName}`);
            console.log(`Bus Type:    ${sample.busTypeName}`);
            console.log(`Departure:   ${sample.departureTime}`);
            console.log(`Arrival:     ${sample.arrivalTime}`);
            console.log(`Travel Time: ${sample.travelTime}`);
            console.log(`Price (Min): ${sample.minFare}`);
        }
        
        fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
