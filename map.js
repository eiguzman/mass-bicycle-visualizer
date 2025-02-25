mapboxgl.accessToken = 'pk.eyJ1IjoiZWlndXptYW4iLCJhIjoiY203OGFhbXVoMHN4ajJrb3Z2ZWUxOW01cyJ9.zc52D1EcGb00gJFeUk6SNg';

const svg = d3.select('#map').select('svg');
let stations = [];
let timeFilter = -1;
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/eiguzman/cm78bcill00sw01re2zxh0gnw',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
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
  const jsonurl = "./data/bluebikes-stations.json";
  d3.json(jsonurl).then(jsonData => {
    stations = jsonData.data.stations;
    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);
    const circles = svg.selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .style("--departure-ratio", d => {
        const ratio = d.totalTraffic > 0 ? (d.departures / d.totalTraffic) : .5;
        return stationFlow(ratio);
        });
    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)
        .attr('cy', d => getCoords(d).cy);
    }
    const csvlink = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
    d3.csv(csvlink).then(trips => {
      let departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id,
      );
      let arrivals = d3.rollup(
        trips,
        (w) => w.length,
        (a) => a.end_station_id,
      );
      stations = stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        station.flow = (station.departures / station.totalTraffic);
        return station;
      });
      radiusScale.domain([0, d3.max(stations, (d) => d.totalTraffic)]);
      circles.data(stations)
        .transition()
        .attr('r', d => radiusScale(d.totalTraffic))
        .each(function(d) {
          d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
      for (let trip of trips) {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        let startedMinutes = minutesSinceMidnight(trip.started_at);
        departuresByMinute[startedMinutes].push(trip);
        let endedMinutes = minutesSinceMidnight(trip.ended_at);
        arrivalsByMinute[endedMinutes].push(trip);
      }
      function minutesSinceMidnight(date) {
        return date.getHours() * 60 + date.getMinutes();
      }
      function filterByMinute(tripsByMinute, minute) {
        let minMinute = (minute - 60 + 1440) % 1440;
        let maxMinute = (minute + 60) % 1440;
        if (minMinute > maxMinute) {
          let beforeMidnight = tripsByMinute.slice(minMinute);
          let afterMidnight = tripsByMinute.slice(0, maxMinute);
          return beforeMidnight.concat(afterMidnight).flat();
        } else {
          return tripsByMinute.slice(minMinute, maxMinute).flat();
        }
      }
      function filterTripsByTime() {
        const filteredDepartures = filterByMinute(departuresByMinute, timeFilter);
        const filteredArrivals = filterByMinute(arrivalsByMinute, timeFilter);
        let filteredDeparturesCount = d3.rollup(
          filteredDepartures,
          (v) => v.length,
          (d) => d.start_station_id,
        );
        let filteredArrivalsCount = d3.rollup(
          filteredArrivals,
          (w) => w.length,
          (a) => a.end_station_id,
        );
        if (timeFilter === -1) {
          filteredDeparturesCount = departures;
          filteredArrivalsCount = arrivals;
        }
        let filteredStations = stations.map((station) => {
          let id = station.short_name;
          station.arrivals = filteredArrivalsCount.get(id) ?? 0;
          station.departures = filteredDeparturesCount.get(id) ?? 0;
          station.totalTraffic = station.arrivals + station.departures;
          return station;
        });
        radiusScale.domain([0, d3.max(filteredStations, (d) => d.totalTraffic)]);
        radiusScale.range(timeFilter === -1 ? [0, 25] : [0, 15]);
        circles.data(filteredStations)
          .transition()
          .attr('r', d => radiusScale(d.totalTraffic))
          .style("--departure-ratio", d => {
            const ratio = d.totalTraffic > 0 ? (d.departures / d.totalTraffic) : 0;
            return stationFlow(ratio);
            })
          .each(function(d) {
            d3.select(this)
              .select('title')
              .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
          });
      }
      const timeSlider = document.getElementById('time-slider');
      timeSlider.addEventListener('input', function() {
        timeFilter = +this.value;
        filterTripsByTime();
      });
      updateTimeDisplay();
    });
  }).catch(error => {
    console.error('Error loading JSON:', error);
  }); 
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <div class="theme-switcher">
        <label class="color-scheme">
            Theme:
            <select id="theme-selector">
                <option value="default">System Default</option>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
            </select>
        </label>
    </div>`
);

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const savedTheme = localStorage.getItem('theme') || 'default';
applyTheme(savedTheme);
const themeSelector = document.getElementById('theme-selector');
themeSelector.value = savedTheme;
themeSelector.addEventListener('change', function() {
  const selectedTheme = this.value;
  applyTheme(selectedTheme);
  localStorage.setItem('theme', selectedTheme);
});