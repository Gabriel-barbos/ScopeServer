import fetch from 'node-fetch';

async function shareVehicles({ token, vehicleIdentifiers, shareGroupId }) {
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

      await fetch('http://localhost:3001/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/VehicleShareManagement(${vehicle.id})/_.share`,
          method: 'POST',
          body: {
            userGroupId: shareGroupId,
            shareInMiddleGroups: true,
            shareVehicleTypes: true,
          },
          token,
        }),
      });

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

export default shareVehicles;