// this is the Map component for React!
// import some dependencies
var React = require('react');
var ReactDOM = require('react-dom');
var L = require('leaflet');
var qwest = require('qwest');
//var Baby = require('babyparse');

// add our subway line filter component
var Filter = require('./Filter');

// let's store the map configuration properties,
// we could also move this to a separate file & require it...
var config = {};

// an array to store BK subway lines
var tmpSubwayLines = [];
// tmp array used to eventually create the above array
var subwayLines = [];
// tmp json for csvdata

console.log("4.38");

// map paramaters to pass to L.map when we instantiate it
config.params = {
    center: [40.655769, -73.938503], //Greenpoint
    zoomControl: false,
    zoom: 13,
    maxZoom: 19,
    minZoom: 7,
    scrollwheel: false,
    legends: true,
    infoControl: false,
    attributionControl: true
};

// params for the L.tileLayer (aka basemap)
// uri: 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
config.tileLayer = {
    uri: 'https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiaWVjcyIsImEiOiJrY3VCVUNNIn0.7dZ0swuFiyqzhMeqwcNVgQ',
    params: {
        minZoom: 7,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        id: '',
        accessToken: ''
    }
};

// here's the actual component
var Map = React.createClass({
    getInitialState: function () {
        // TODO: if we wanted an initial "state" for our map component we could add it here
        return {
            tileLayer: null,
            geojsonLayer: null,
            geojson: null,
            filter: '*',
            numEntrances: null
        };
    },

    fetchingData: false,
//    fetchingTrafficData: false,

    // a variable to store our instance of L.map
    map: null,

    componentWillMount: function () {
        // code to run just before adding the map
    },

    componentDidMount: function () {
        console.log(this);
//        console.log('componentDidMount')
//        console.log('isfetchingData: ' + this.fetchingData);
//        console.log('isfetchingTrafficData: ' + this.fetchingTrafficData);    
        // code to run just after the component "mounts" / DOM elements are created
        // read csv data
//        console.log('isItfecthingtraffic: ' + (!this.fetchingTrafficData && this.state.csvdata == null));
        if (!this.fetchingTrafficData && this.state.csvdata == null) this.getTrafficData();
        // make the AJAX request for the GeoJSON data
//        console.log('isfetchingData: ' + this.fetchingData);
//        console.log('isfetchingTrafficData: ' + this.fetchingTrafficData);    
        if (!this.fetchingData) this.getData();
        // create the Leaflet map object
        if (!this.map) this.init(this.getID());
    },

    componentDidUpdate(prevProps, prevState) {
        // code to run when the component receives new props or state
        // check to see if geojson is stored, map is created, and geojson overlay needs to be added
        if (this.state.geojson && this.map && !this.state.geojsonLayer) {
            // add the geojson overlay
            this.addGeoJSONLayer(this.state.geojson);
        }

        // check to see if the subway lines filter has changed
        if (this.state.filter !== prevState.filter) {
            // filter / re-render the geojson overlay
            this.filterGeoJSONLayer();
        }
    },

    componentWillUnmount: function () {
        // code to run just before unmounting the component
        // this destroys the Leaflet map object & related event listeners
        this.map.remove();
    },

    updateMap: function (subwayLine) {
        // change the subway line filter
        if (subwayLine === "All lines") {
            subwayLine = "*";
        }
        // update our state with the new filter value
        this.setState({
            filter: subwayLine
        });
    },

    getData: function () {
        console.log("getData started");
        this.fetchingData = true;
        var that = this;
//        console.log(that.state.csvdata);
        

        // qwest is a library for making Ajax requests, we use it here to load GeoJSON data
        qwest.get('station_data.geojson', null, {
                responseType: 'json'
            })
            .then(function (xhr, res) {
                if (that.isMounted()) {
                    // store the number of GeoJSON features (subway entrances) in the component's state for use later
                    // as well as the raw GeoJSON data so it can be reused
                    that.setState({
                        numEntrances: res.features.length,
                        geojson: res
                    });
                }
                that.fetchingData = false;
            console.log('getData ended');
            })
            .catch(function (xhr, res, e) {
                console.log('qwest catch: ', xhr, res, e);
            });
    },
    
    getTrafficData: function () {
        isFetchingTrafficData = true;
        console.log('fetchtrafficdata_started');
        this.fetchingTrafficData = true;
        console.log(this.fetchingTrafficData);
        var that = this;

        qwest.get('201508_trip_data_sample.csv', null, {
            responseType: 'text'
        })
        .then(function (xhr, res) {
            if(that.isMounted()){
                var traffic = Baby.parse(res, {header: true});
                that.setState({
                    csvdata: traffic
                });
            }
            that.fetchingTrafficData = false;
            console.log('fetchtrafficdata_ended');
            console.log(that.state.csvdata);
            isFetchingTrafficData = false;
        });
    },

    addGeoJSONLayer: function (geojson) {
        // create a native Leaflet GeoJSON SVG Layer to add as an interactive overlay to the map
        // an options object is passed to define functions for customizing the layer
        var geojsonLayer = L.geoJson(geojson, {
            onEachFeature: this.onEachFeature,
            pointToLayer: this.pointToLayer
        });
        // add our GeoJSON layer to the Leaflet map object
        geojsonLayer.addTo(this.map);
        // store the Leaflet GeoJSON layer in our component state for use later
        this.setState({
            geojsonLayer: geojsonLayer
        });
        // fit the geographic extent of the GeoJSON layer within the map's bounds / viewport
        this.zoomToFeature(geojsonLayer);
    },

    filterGeoJSONLayer: function () {
        // clear the geojson layer of its old data
        this.state.geojsonLayer.clearLayers();
        // create the new geojson layer with a filter function
        var geojsonLayer = L.geoJson(this.state.geojson, {
            onEachFeature: this.onEachFeature,
            pointToLayer: this.pointToLayer,
            filter: this.filter
        });
        // add the new geojson layer to the map
        geojsonLayer.addTo(this.map);
        // update the component state with the new geojson layer
        this.setState({
            geojsonLayer: geojsonLayer
        });
        // fit the map to the new geojson layer's geographic extent
        this.zoomToFeature(geojsonLayer);
    },

    zoomToFeature: function (target) {
        // pad fitBounds() so features aren't hidden under the Filter UI element
        var fitBoundsParams = {
            paddingTopLeft: [200, 10],
            paddingBottomRight: [10, 10]
        };
        // set the map's center & zoom so that it fits the geographic extent of the layer
        this.map.fitBounds(target.getBounds(), fitBoundsParams);
    },

    filter: function (feature, layer) {
        // filter the subway entrances based on the map's current search filter
        // returns true only if the filter value matches the value of feature.properties.LINE
        var test = feature.properties.LINE.split('-').indexOf(this.state.filter);

        if (this.state.filter === '*' || test !== -1) {
            return true;
        }
    },

    pointToLayer: function (feature, latlng) {
        this.fetchingTrafficData = true;
        this.fetchingData = true;
        // renders our GeoJSON points as circle markers, rather than Leaflet's default image markers
    
//        function getSumOfTraffic(station_id){
//            if(this.state.csvdata != null){
//            var tmpSum = 0;
//                for(i=0; i < this.state.csvdata.data.length; i++){
//                    console.log(this.state.csvdata.data[i].end_id);
//                    if(this.state.csvdata.data[i].end_id == station_id){
//                        tmpSum += 1;
//                    }
//                }
//            }
//            return station_id;
//        };
        
//        function far(x){
//            return 2;
////            return getSumOfTraffic(2);
////          return parseInt(this.state.csvdata.data[1].end_id);  
//        };
        
//        var sumOfTraffic = far(feature.properties.station_id);
        // parameters to style the GeoJSON markers
        var markerParams = {
            radius: 9,
            fillColor: 'orange',
            color: '#fff',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.8
        };

        return L.circleMarker(latlng, markerParams);
    },

    onEachFeature: function (feature, layer) {
        // this method is used to create popups for the GeoJSON features
        // it also creates the initial array of unique subway line names which is later passed to the Filter component

        if (feature.properties && feature.properties.NAME && feature.properties.LINE) {
            // if the array for unique subway line names has not been made, create it
            if (subwayLines.length === 0) {
                // add subway line names to a temporary subway lines array
                feature.properties.LINE.split('-').forEach(function (line, index) {
                    tmpSubwayLines.push(line);
                });

                // on the last GeoJSON feature make a new array of unique values from the temporary array
                if (this.state.geojson.features.indexOf(feature) === this.state.numEntrances - 1) {
                    // use filter() to make sure the subway line names array has one value for each subway line
                    // use sort() to put our values in numeric and alphabetical order
                    subwayLines = tmpSubwayLines.filter(function (value, index, self) {
                        return self.indexOf(value) === index;
                    }).sort();
                    // finally add a value to represent all of the subway lines
                    subwayLines.unshift('All lines');
                }
            }

            // assemble the HTML for the markers' popups
            var popupContent = '<h3>' + feature.properties.NAME +
                '</h3><strong>Access to MTA lines:</strong> ' +
                feature.properties.LINE;
            // add our popups
            layer.bindPopup(popupContent);
        }
    },

    getID: function () {
        // get the "id" attribute of our component's DOM node
        return ReactDOM.findDOMNode(this).querySelectorAll('#map')[0];
    },

    init: function (id) {
        if (this.map) return;
        // this function creates the Leaflet map object and is called after the Map component mounts
        this.map = L.map(id, config.params);
        L.control.zoom({
            position: "bottomleft"
        }).addTo(this.map);
        L.control.scale({
            position: "bottomleft"
        }).addTo(this.map);

        // a TileLayer is used as the "basemap"
        var tileLayer = L.tileLayer(config.tileLayer.uri, config.tileLayer.params).addTo(this.map);

        // set our state to include the tile layer
        this.setState({
            tileLayer: tileLayer
        });
    },

    render: function () {
        // return our JSX that is rendered to the DOM
        // we pass our Filter component props such as subwayLines array, filter & updateMap methods

        return (
            <div id="mapUI">
                {
                /* render the Filter component only after the subwayLines array has been created */
                subwayLines.length ?
                <Filter lines={subwayLines} curFilter={this.state.filter} filterLines={this.updateMap} /> :
                null
                }
                <div id="map" />
            </div>
        );
    }
});

// export our Map component so that Browserify can include it with other components that require it
module.exports = Map;
