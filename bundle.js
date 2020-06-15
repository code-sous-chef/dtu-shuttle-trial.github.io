(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var spherekd = require("./lib/spherekd")

module.exports = function(points) {
  /* Inflate the toad! */
  var root = spherekd.build(points)

  /* Lurch off into the sunset! */
  return function(lat, lon, n, max) {
    return spherekd.lookup(lat, lon, root, n, max)
  }
}

},{"./lib/spherekd":4}],2:[function(require,module,exports){
function defaultComparator(a, b) {
  return a - b
}

exports.search = function(item, array, comparator) {
  if(!comparator)
    comparator = defaultComparator

  var low  = 0,
      high = array.length - 1,
      mid, comp

  while(low <= high) {
    mid  = (low + high) >>> 1
    comp = comparator(array[mid], item)

    if(comp < 0)
      low = mid + 1

    else if(comp > 0)
      high = mid - 1

    else
      return mid
  }

  return -(low + 1)
}

exports.insert = function(item, array, comparator) {
  var i = exports.search(item, array, comparator)

  if(i < 0)
    i = -(i + 1)

  array.splice(i, 0, item)
}

},{}],3:[function(require,module,exports){
var binary = require("./binary")

function Node(axis, split, left, right) {
  this.axis  = axis
  this.split = split
  this.left  = left
  this.right = right
}

function distance(a, b) {
  var i = Math.min(a.length, b.length),
      d = 0,
      k

  while(i--) {
    k  = b[i] - a[i]
    d += k * k
  }

  return d
}

function byDistance(a, b) {
  return a.dist - b.dist
}

function buildrec(array, depth) {
  /* This should only happen if you request a kd-tree with zero elements. */
  if(array.length === 0)
    return null

  /* If there's only one item, then it's a leaf node! */
  if(array.length === 1)
    return array[0]

  /* Uh oh. Well, we have to partition the data set and recurse. Start by
   * finding the bounding box of the given points; whichever side is the
   * longest is the one we'll use for the splitting plane. */
  var axis = depth % array[0].position.length

  /* Sort the points along the splitting plane. */
  /* FIXME: For very large trees, it would be faster to use some sort of median
   * finding and partitioning algorithm. It'd also be a lot more complicated. */
  array.sort(function(a, b) {
    return a.position[axis] - b.position[axis]
  })

  /* Find the median point. It's position is going to be the location of the
   * splitting plane. */
  var i = Math.floor(array.length * 0.5)

  /* Split, recurse, yadda yadda. */
  ++depth

  return new Node(
    axis,
    array[i].position[axis],
    buildrec(array.slice(0, i), depth),
    buildrec(array.slice(i   ), depth)
  )
}

function build(array) {
  return buildrec(array, 0)
}

function lookup(position, node, n, max) {
  if(!(max > 0))
    max = Number.POSITIVE_INFINITY

  var array = []

  /* Degenerate cases. */
  if(node === null || n <= 0)
    return array

  var stack = [node, 0],
      dist, i

  while(stack.length) {
    dist = stack.pop()
    node = stack.pop()

    /* If this subtree is further away than we care about, then skip it. */
    if(dist > max)
      continue

    /* If we've already found enough locations, and the furthest one is closer
     * than this subtree possibly could be, just skip the subtree. */
    if(array.length === n && array[array.length - 1].dist < dist * dist)
      continue

    /* Iterate all the way down the tree, adding nodes that we need to remember
     * to visit later onto the stack. */
    while(node instanceof Node) {
      if(position[node.axis] < node.split) {
        stack.push(node.right, node.split - position[node.axis])
        node = node.left
      }

      else {
        stack.push(node.left, position[node.axis] - node.split)
        node = node.right
      }
    }

    /* Once we've hit a leaf node, insert it into the array of candidates,
     * making sure to keep the array in sorted order. */
    dist = distance(position, node.position)
    if(dist <= max * max)
      binary.insert({object: node, dist: dist}, array, byDistance)

    /* If the array's too long, cull it. */
    if(array.length > n)
      array.pop()
  }

  /* Strip candidate wrapper objects. */
  i = array.length

  while(i--)
    array[i] = array[i].object

  return array
}

exports.build  = build
exports.lookup = lookup

},{"./binary":2}],4:[function(require,module,exports){
"use strict";
const kd               = require("./kd"),
      rad              = Math.PI / 180,
      invEarthDiameter = 1 / 12742018 /* meters */;

function spherical2cartesian(lat, lon) {
  lat *= Math.PI / 180;
  lon *= Math.PI / 180;
  const cos = Math.cos(lat);
  return [cos * Math.cos(lon), Math.sin(lat), cos * Math.sin(lon)]
}

class Position {
  constructor(object) {
    let lat = NaN,
        lon = NaN;

    if(Array.isArray(object)) {
      lat = object[0];
      lon = object[1];
    }

    else if(object.hasOwnProperty("location")) {
      lat = object.location[0];
      lon = object.location[1];
    }

    else if(object.hasOwnProperty("position")) {
      lat = object.position[0];
      lon = object.position[1];
    }

    else if(object.hasOwnProperty("geometry") &&
            object.geometry.hasOwnProperty("type") &&
            object.geometry.type === "Point") {
      lat = object.geometry.coordinates[1];
      lon = object.geometry.coordinates[0];
    }

    else {
      if(object.hasOwnProperty("lat")) {
        lat = object.lat;
      }
      else if(object.hasOwnProperty("latitude")) {
        lat = object.latitude;
      }

      if(object.hasOwnProperty("lon")) {
        lon = object.lon;
      }
      else if(object.hasOwnProperty("lng")) {
        lon = object.lng;
      }
      else if(object.hasOwnProperty("long")) {
        lon = object.long;
      }
      else if(object.hasOwnProperty("longitude")) {
        lon = object.longitude;
      }
    }

    this.object   = object;
    this.position = spherical2cartesian(lat, lon);
  }

  static create(object) {
    return new Position(object);
  }

  static extract(position) {
    return position.object;
  }
}

function build(array) {
  return kd.build(array.map(Position.create));
}

function lookup(lat, lon, node, n, max) {
  return kd.
    lookup(
      spherical2cartesian(lat, lon),
      node,
      n,
      max > 0 ? 2 * Math.sin(max * invEarthDiameter) : undefined
    ).
    map(Position.extract);
}

exports.build  = build;
exports.lookup = lookup;

},{"./kd":3}],5:[function(require,module,exports){
var id, options;
function pointObject(lat,lng,num){
    this.latitude=lat,
    this.longitude=lng,
    this.pointnum=num
}
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function() {
      return this * Math.PI / 180;
    }
  }
  var R = 6371; // km
  var dLat = (lat2-lat1).toRad();
  var dLon = (lon2-lon1).toRad();
  var lat1 = lat1.toRad();
  var lat2 = lat2.toRad();

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) *    Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var distance = R * c;

  return distance;
}
var point1=new pointObject(28.541011, 77.157927,1);
var point2=new pointObject(28.540815, 77.158387,2);
var point3=new pointObject(28.540625, 77.158857,3);
var point4=new pointObject(28.540400, 77.159352,4);
var point5=new pointObject(28.540751, 77.159586,5);
var point6=new pointObject(28.541156, 77.159763,6);
var sphereKnn=require("sphere-knn");
lookup=sphereKnn([point1,point2,point3,point4,point5,point6]);
options ={
    enableHighAccuracy:false,
    timeout:100,
    maximumage: 0
}
function liveLocation(evt){
    var currPointObj =lookup(evt.coords.latitude,evt.coords.longitude,1,100)[0];
    var currentPoint=currPointObj.pointnum;
    display(currentPoint);
}
function userShuttleDistance(currentPoint,userPoint){
  var distance=Math.abs(currentPoint-userPoint)*50;
  return distance;
}
function display(currentPoint){
  document.querySelector("h2").innerHTML="Shuttle is At Point"+currentPoint;
  var dist=userShuttleDistance(currentPoint,1);
  document.querySelector("h3").innerHTML="Shuttle is at a distance "+dist+" metre";  
}
function error(evt){
    console.log("error");
}
function buttonclick(){
  id=navigator.geolocation.watchPosition(liveLocation,error,options);
}
document.querySelector(".btn").addEventListener("click",buttonclick);
},{"sphere-knn":1}]},{},[5]);
