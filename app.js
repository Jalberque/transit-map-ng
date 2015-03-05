'use strict';
angular.module('transitMap', ['ngTouch']).factory('transLoc', function($http, $q, $filter){
	var baseUrl = "https://transloc-api-1-2.p.mashape.com/";
	var headers = {'X-Mashape-Key': 'QcvihLtHdgmshtY0Yjsg7nytW4Iqp1MEy05jsnSqvl1Lqjt9eW'};
	var transLocFactory = {};
	transLocFactory.getRoutes = function (short_name) {
		var d = $q.defer();
		$http({
			url: baseUrl + '/routes.json',
			params: {
				agencies: '20'
			},
			headers: headers
		}).success(function (routes) {
			var route = $filter('filter')(routes.data[20], function (r) {
				return r.short_name === short_name;
			});
			if (route.length > 0) {
				d.resolve(route[0].route_id);
			}
		});
		return d.promise;
	};
	transLocFactory.getSegments = function (id) {
		var d = $q.defer();
		$http({
			url: baseUrl + '/segments.json',
			params: {
				agencies: '20',
				routes: id
			},
			headers: headers
		}).success(function (data) {
			d.resolve(data);
		});
		return d.promise;
	};
	transLocFactory.getStops= function (id) {
		var d = $q.defer();
		$http({
			url: baseUrl + '/stops.json',
			params: {
				agencies: '20'
			},
			headers: headers
		}).success(function (stops) {
			d.resolve($filter('filter')(stops.data, function (s) {
				return s.routes.indexOf(id) > -1;
			}));
		});
		return d.promise;		
	};
	transLocFactory.getEstimates= function (ids, routeId) {
		var d = $q.defer();
		$http({
			url: baseUrl + '/arrival-estimates.json',
			params: {
				agencies: '20',
				routes: routeId,
				stops: ids
			},
			headers: headers
		}).success(function (estimates) {
			d.resolve(estimates);
		});
		return d.promise;		
	};	
	transLocFactory.getVehicles= function (id) {
		var d = $q.defer();
		$http({
			url: baseUrl + '/vehicles.json',
			params: {
				agencies: '20',
				routes: id
			},
			headers: headers
		}).success(function (vehicles) {
			d.resolve(vehicles.data[20]);
		});
		return d.promise;		
	};		
	return transLocFactory;
}).directive('transitMap', function () {
	return {
		retrict: 'E',
		template: '<div id="map"></div>',
		scope: {
			level: '=level',
			center: '=center'
		},
		controller: function ($scope, $rootScope, $filter, $interval, transLoc) {
			var map = L.map('map');
			$rootScope.map = map;
			initMap(map);
			getRoute();
			function initMap (map) {
				var hour = new Date().getHours();
				console.log(hour);
				var baseUrl = 'http://{s}.basemaps.cartocdn.com/' + ((hour > 17 || hour < 6) ? 'dark' : 'light') + '_all/{z}/{x}/{y}.png';
				L.tileLayer(baseUrl,{
  					attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
					subdomains: 'abcd',
					minZoom: 4,
					maxZoom: 16
				}).addTo(map);
				map.setView($scope.center, $scope.level);				
			}
			function getRoute () {
				transLoc.getRoutes($rootScope.route).then(function (id) {
					getStops(id);
					getSegments(id);
				});
			}
			function getSegments (id) {
				transLoc.getSegments(id).then(function (segments) {
					addSegmentsToMap(segments.data);
				});
			}
			function addSegmentsToMap (segments) {
				//var gjObj = {type: 'FeatureCollection', features: [{type: 'Feature', geometry: {type:'MultiLineString', coordinates: []}}]};
				var gjObj = {type: 'FeatureCollection', features: []};
				angular.forEach(segments, function (s) {
					//gjObj.features[0].geometry.coordinates.push(decodeSegment(s));
					gjObj.features.push({type: 'Feature', geometry: {type:'LineString', coordinates: decodeSegment(s)}});
				});
				var gj = L.geoJson(gjObj, {
					style: {color: '#EB3D00', opacity: 0.80}
				});
				map.addLayer(gj);
				map.fitBounds(gj.getBounds());
			}
			function decodeSegment (encoded) {
				var len = encoded.length;
                var index = 0;
                var array = [];
                var lat = 0;
                var lng = 0;
                while (index < len) {
                    var b;
                    var shift = 0;
                    var result = 0;
                    do {
                        b = encoded.charCodeAt(index++) - 63;
                        result |= (b & 0x1f) << shift;
                        shift += 5;
                    } while (b >= 0x20);
                    var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
                    lat += dlat;
                    shift = 0;
                    result = 0;
                    do {
                        b = encoded.charCodeAt(index++) - 63;
                        result |= (b & 0x1f) << shift;
                        shift += 5;
                    } while (b >= 0x20);
                    var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
                    lng += dlng;
                    array.push([lng * 1e-5, lat * 1e-5]);
                 }
                 return array;
			}
			function getStops (id) {
				transLoc.getStops(id).then(function (data) {
					mapStops(data);
					$rootScope.stops = data;
					getVehicles(id);
					$interval(function () {
						getVehicles(id);
					}, 5000);
				});
			}
			function getVehicles (id) {
				transLoc.getVehicles(id).then(function (vehicles) {
					angular.forEach(vehicles, function (v) {
						angular.forEach(v.arrival_estimates, function (a) {
							var stop = $filter('filter')($rootScope.stops, function (s) {
								return a.stop_id === s.stop_id;
							});
							if (stop.length > 0) {
								stop = stop[0];
								a.stop_name = stop.name;
								a.location = stop.location;
								var diff = new Date(a.arrival_at) - new Date();
								a.time = (diff/1000)/60;
								var min = Math.floor(a.time);
								var sec = Math.floor((a.time - min) * 60);
								a.minsec = min + ' min ' + sec + ' sec'
							}
						});
					});
					$rootScope.vehicles = vehicles;
					mapVehicles(vehicles);
				});
			}
			function mapVehicles (vehicles) {
				var gjObj = {type: 'FeatureCollection', features: []};
				angular.forEach(vehicles, function (v) {
					gjObj.features.push({type: 'Feature', geometry: {type:'Point', coordinates: [v.location.lng, v.location.lat]}, properties: {call_name: v.call_name}});
				});
				if (!$scope.vehiclesGj) {
					$scope.vehiclesGj = new L.geoJson(gjObj, {onEachFeature: function (feature, layer) {
						layer.bindLabel(feature.properties.call_name, {noHide: true});
					}}).addTo($rootScope.map);
				} else {
					$scope.vehiclesGj.clearLayers();
					$scope.vehiclesGj.addData(gjObj);
				}
			}
			function mapStops (stops) {
				var gjObj = {type: 'FeatureCollection', features: []};
				angular.forEach(stops, function (s) {
					gjObj.features.push({type: 'Feature', geometry: {type:'Point', coordinates: [s.location.lng, s.location.lat]}, properties:{stop_name: s.name}});
				});
				if (!$scope.stopsGj) {
					$scope.stopsGj = new L.geoJson(gjObj, {onEachFeature: function (feature, layer) {
						L.circle(layer.getLatLng(), 20, {opacity: 1, fillOpacity: 1, fillColor: '#FF0840', color: 'white', weight: 1}).bindLabel(feature.properties.stop_name, {noHide: false})
						.on('mouseover', function (e) {
							e.target.setStyle({fillColor: 'yellow'});
						})
						.on('mouseout', function (e) {
							e.target.setStyle({fillColor: '#FF0840'});
						})
						.addTo(map);
					}});
				} else {
					$scope.stopsGj.clearLayers();
					$scope.stopsGj.addData(gjObj);
				}
			}			
		}
	}
}).directive('transitSchedule', function () {
	return {
		restrict: 'E',
		template: 
		'<div id="schedule">'+
			'<input class="transitInput" placeholder="Filter by stop name..." ng-model="transitSearch"></input>'+
			'<h4>Estimated Arrival Times</h4>'+
			'<select class="transitInput" ng-model="selectedTime" ng-init="selectedTime = selectedTime || times[1]" ng-options="time as time.label for time in times"></select>'+
			'<br/><em ng-show="vehicles.length === 0">No buses currently running on this route</em>'+
			'<div ng-repeat="vehicle in vehicles | orderBy: ' + "'call_name'" + '" ng-model="vehicle">'+
				'<strong class="busHeader" ng-click="stopClick(vehicle.location)">Bus {{vehicle.call_name}}</strong>'+
				'<em ng-show="vehicle.arrival_estimates.length === 0">Bus not currently running</em>'+
				'<ul class="busList"><li ng-class="{redBus: estimate.time <= 5, orangeBus: estimate.time <= 10 && estimate.time > 5}" '+
					'ng-repeat="estimate in vehicle.arrival_estimates | filter:{stop_name: transitSearch} | filter: estimateFilter | orderBy: ' + "'time'" + '" '+
					'ng-model="stop" ng-click="stopClick(estimate.location)" ng-mouseover="stopOver(estimate)" ng-mouseleave="stopLeave()">'+
					'{{estimate.stop_name}} ({{estimate.minsec}})</li>'+
				'</ul></div></div>',
		controller: function ($scope, $rootScope, $location) {
			$scope.transitSearch = "";
			$scope.over = false;
			$scope.times = [
				{value: 10, label:'Arriving in under 10 minutes'},
				{value: 20, label:'Arriving in under 20 minutes'},
				{value: 30, label:'Arriving in under 30 minutes'},
				{value: 40, label:'Arriving in under 40 minutes'},
				{value: 50, label:'Arriving in under 50 minutes'},
				{value: 60, label:'Arriving in under 60 minutes'}];
			$scope.stopClick = function (location) {
				$rootScope.map.setView([location.lat, location.lng], 16);
			}
			$scope.stopOver = function (stop) {
				if (!$scope.over) {
					if (!$scope.highlightedStop) {
						$scope.highlightedStop = L.layerGroup().addTo($rootScope.map)
					}

					L.circleMarker([stop.location.lat, stop.location.lng], {opacity: 1, fillOpacity: 1, fillColor: 'yellow', color: 'white', weight: 1}).bindLabel(stop.stop_name, {noHide: true}).addTo($scope.highlightedStop);
					$scope.over = true;					
				}
			
			};
			$scope.stopLeave = function () {
				$scope.highlightedStop.clearLayers();
				$scope.over = false;
			};
			$scope.estimateFilter = function (estimate) {
		        return estimate.time <= $scope.selectedTime.value && estimate.time > 0.01;
		    };		
		}
	}
});