// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiZWlndXptYW4iLCJhIjoiY203OGFhbXVoMHN4ajJrb3Z2ZWUxOW01cyJ9.zc52D1EcGb00gJFeUk6SNg';

const svg = d3.select('#map').select('svg');
let stations = [];
// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/eiguzman/cm78bcill00sw01re2zxh0gnw', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => { 
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
  });
  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'rgb(250, 210, 247)',
      'line-width': 5,
      'line-opacity': 0.6
    }
  });
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson?...'
  });
  map.addLayer({
    id: 'bike-lanes_c',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'rgb(162, 250, 250)',
      'line-width': 5,
      'line-opacity': 0.6
    }
  });
});

map.on('load', () => {
  // Load the nested JSON file
  const jsonurl = "./data/bluebikes-stations.json"
  d3.json(jsonurl).then(jsonData => {
    let stations = jsonData.data.stations;
  // Append circles to the SVG for each station
  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);
  const circles = svg.selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))  // Radius of the circle
    .attr('fill', 'steelblue')  // Circle fill color
    .attr('stroke', 'black')    // Circle border color
    .attr('stroke-width', 1)    // Circle border thickness
    .attr('opacity', 0.8);      // Circle opacity
  // Initial position update when map loads
  updatePositions();
  // Reposition markers on map interactions
  map.on('move', updatePositions);     // Update during map movement
  map.on('zoom', updatePositions);     // Update during zooming
  map.on('resize', updatePositions);   // Update on window resize
  map.on('moveend', updatePositions);  // Final adjustment after movement ends
  // Function to update circle positions when the map moves/zooms
  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
      .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
      }
  const csvlink = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
  d3.csv(csvlink).then(trips => {
    departures = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.start_station_id,
    );
    arrivals = d3.rollup(
      trips,
      (w) => w.length,
      (a) => a.end_station_id,
    );
    stations = stations.map((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic= station.arrivals + station.departures;
      return station;
    });
    radiusScale.domain([0, d3.max(stations, (d) => d.totalTraffic)]);
    // Update the circles now that we have totalTraffic values
    circles.data(stations)  // Bind the updated stations data
      .transition()     // Animate the transition
      .attr('r', d => radiusScale(d.totalTraffic))  // Update the radius based on new traffic data
      .each(function(d) {
        // Add <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
      });
  }).catch(error => {
    console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
  }); 
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point);  // Project to pixel coordinates
  return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

