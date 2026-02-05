import fetch from 'node-fetch';

async function addVehiclesToGroup({ token, vehicleIdentifiers, vehicleGroupId }) {
  const results = [];

  for (const identifier of vehicleIdentifiers) {
    try {
      const searchRes = await fetch('http://localhost:3001/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/Vehicles?$filter=vin eq '${identifier}'&$select=id,vin`,
          method: 'GET',
          token,
        }),
      });

      const searchData = await searchRes.json();
      const vehicle = searchData?.value?.[0];

      if (!vehicle) {
        results.push({
          chassi: identifier,
          success: false,
          error: 'Veículo não encontrado',
        });
        continue;
      }

      const addRes = await fetch('http://localhost:3001/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/VehicleGroups(${vehicleGroupId})/_.addVehicles`,
          method: 'POST',
          body: { vehicleIds: [vehicle.id] },
          token,
        }),
      });

      if (![200, 204].includes(addRes.status)) {
        throw new Error(`Status ${addRes.status}`);
      }

      results.push({
        chassi: identifier,
        success: true,
      });
    } catch (err) {
      results.push({
        chassi: identifier,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}

export default addVehiclesToGroup;