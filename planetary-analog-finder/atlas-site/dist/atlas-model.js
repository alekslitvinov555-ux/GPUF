/* Uses the existing PANEM_U data format and Gaussian criterion scoring. */
(function (root) {
  const countries=window.ATLAS_COUNTRIES.map(({properties,geometry})=>({
    id:properties.name,name:properties.name,
    polygons:geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates
  }));
  function inRing(x,y,ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [ax,ay]=ring[i], [bx,by]=ring[j];
      if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
    }
    return inside;
  }
  function contains(country,lon,lat) {
    return country.polygons.some(([outer,...holes])=>inRing(lon,lat,outer) &&
      !holes.some(hole=>inRing(lon,lat,hole)));
  }
  function distanceKm(a,b) {
    const radians=Math.PI/180;
    const deltaLat=(a.lat-b.lat)*radians,deltaLon=(a.lon-b.lon)*radians;
    const h=Math.sin(deltaLat/2)**2 + Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(deltaLon/2)**2;
    return 12742*Math.asin(Math.sqrt(Math.min(1,h)));
  }
  function createModel(data) {
    const cells = data.lat.map((latIndex, index) => {
      const lat = latIndex / 2;
      const lon = data.lon[index] * data.grid.dlon;
      const country=countries.find(area=>[-.5,0,.5].every(y=>[-.5,0,.5].every(x=>
        contains(area,lon+x*data.grid.dlon,lat+y*data.grid.dlat))));
      const nearest = data.config.known_analogs.reduce((best, analog) => {
        const km=distanceKm({lat,lon},analog);
        return km<best.km ? {km,name:analog.name} : best;
      },{km:Infinity,name:null});
      return { index, lat, lon, country, nearest, area: Math.cos(lat * Math.PI / 180) + 1e-6 };
    });
    const features = data.config.features;
    const distributions = {};
    for (const key of Object.keys(features)) {
      const values = data.values[key].map(raw => raw == null ? null : raw / data.scale[key]);
      const sorted = cells.filter(cell => Number.isFinite(values[cell.index]))
        .sort((a, b) => values[a.index] - values[b.index]);
      const total = sorted.reduce((sum, cell) => sum + cell.area, 0);
      const percentiles = [];
      let cumulative = 0;
      for (let start = 0; start < sorted.length;) {
        let stop = start;
        let tiedArea = 0;
        const value = values[sorted[start].index];
        while (stop < sorted.length && values[sorted[stop].index] === value) {
          tiedArea += sorted[stop].area;
          stop++;
        }
        for (let i = start; i < stop; i++) percentiles[sorted[i].index] = (cumulative + tiedArea / 2) / total;
        cumulative += tiedArea;
        start = stop;
      }
      distributions[key] = { values, percentiles, sorted, total };
    }
    function rank(profileId, weights, allowed, novelOnly=false) {
      const profile = data.config.profiles[profileId];
      const criteria = Object.entries(profile.targets).filter(([key]) => weights[key] > 0)
        .map(([key, target]) => {
          const distribution = distributions[key];
          const direct = Number.isFinite(target.tolerance);
          const goal = direct ? target.value : target.pct ?? distribution.sorted.reduce(
            (sum, cell) => sum + (distribution.values[cell.index] <= target.value ? cell.area : 0), 0
          ) / distribution.total;
          return { key, target, distribution, direct, goal, weight: weights[key] };
        });
      if (!criteria.length) return [];
      const eligible = cells.filter(cell => cell.country && allowed.includes(cell.country.id) && (!novelOnly || cell.nearest.km>data.novelty_km));
      return eligible.flatMap(cell => {
        const rows = criteria.map(criterion => {
          const { key, target, distribution, direct, goal, weight } = criterion;
          const value = distribution.values[cell.index];
          const percentile = distribution.percentiles[cell.index];
          const actual = direct ? value : percentile;
          const scale=direct ? target.tolerance : data.sigma;
          const difference=actual-goal;
          const distance=difference/scale;
          return { key, feature: features[key], target, value, percentile, goal, direct, weight, actual, difference, scale, distance,
            score: Number.isFinite(actual) ? Math.exp(-distance * distance) : null };
        });
        if (rows.some(row => row.score === null)) return [];
        const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
        for (const row of rows) row.contribution=row.score*row.weight/totalWeight;
        const score=rows.reduce((sum,row)=>sum+row.contribution,0);
        return [{ ...cell, rows, score, totalWeight }];
      }).sort((a, b) => b.score - a.score || a.index - b.index);
    }
    return { rank, cells };
  }
  root.createAtlasModel = createModel;
})(globalThis);
