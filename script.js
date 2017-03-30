

function getTilesFromGeometry(geometry, template, zoom){
  function long2tile(lon,zoom) {
    return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
  }
  function lat2tile(lat,zoom) {
    return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
  }
  function replaceInTemplate(point){
    return template.replace('{z}', point.z)
      .replace('{x}', point.x)
      .replace('{y}', point.y);
  }

  var allLat = geometry.map(function(point){
    return point.lat;
  });
  var allLng = geometry.map(function(point){
    return point.lng;
  });
  var minLat = Math.min.apply(null, allLat);
  var maxLat = Math.max.apply(null, allLat);
  var minLng = Math.min.apply(null, allLng);
  var maxLng = Math.max.apply(null, allLng);
  var top_tile    = lat2tile(maxLat, zoom); // eg.lat2tile(34.422, 9);
  var left_tile   = long2tile(minLng, zoom);
  var bottom_tile = lat2tile(minLat, zoom);
  var right_tile  = long2tile(maxLng, zoom);

  var allTiles = [];
  for (var y = top_tile; y < bottom_tile + 1; y++) {
    var tileRow = [];
    for (var x = left_tile; x < right_tile + 1; x++) {
      tileRow.push(replaceInTemplate({x, y, z: zoom}))
    }
    allTiles.push(tileRow);
  }

  return allTiles;
}

function onClickHandler() {
    new DroneDeploy({version: 1}).then(function(dronedeploy){
      dronedeploy.Plans.getCurrentlyViewed().then(function(plan){
        var zoom = 20;
        dronedeploy.Tiles.get({planId: plan.id, layerName: 'ortho', zoom: zoom})
          .then(function(res){
            console.log(res);
            const allTiles = getTilesFromGeometry(plan.geometry, res.template, zoom);
            var canvasAndPromises = drawMatrix(allTiles);
            tileCanvas = canvasAndPromises[0];
            allPromises = canvasAndPromises[1];
            generatePDF(tileCanvas, allPromises);
          });
      });
    });
};

// Draw the matrix of URLs into the canvas
// ctx - function to draw on the canvas
function drawMatrix(allTiles) {
    let tileCanvas = document.createElement('canvas');
    var allPromises = [];
    tileCanvas.display = 'hidden';
    var ctx = tileCanvas.getContext('2d');
    for (var i = 0; i < allTiles.length; i++) {
      let tileRow = allTiles[i];
      for (var j = 0; j < tileRow.length; j++) {
        let tileUrl = tileRow[j];
        allPromises.push(new Promise(function (resolve) {
            let img = new Image();
            img.crossOrigin = "Anonymous"
            img.onload = function() {
                ctx.drawImage(img, j * img.width, i * img.height);
                resolve();
            };
            img.src = tileUrl;
        }));
      }
    }
    return [tileCanvas, Promise.all(allPromises)];   
}

function TilesServer(allTiles) {
    const webServerUrl = "https://dd-pdf-server.herokuapp.com/encode/";
    const body = JSON.stringify ({
        'tile': allTiles
    });
    return fetch(webServerUrl, {
        method: 'Post',
        body: body
    })
        .then((res) => res.json())
        .then((rjson) => rjson.msg);
}

// Put the content of the canvas into the PDF
function generatePDF (tileCanvas, allTilesResolved) {
    allTilesResolved.then(function(){
        var doc = new jsPDF();
        var dataUrl = tileCanvas.toDataURL('image/jpeg');
        doc.addImage(dataUrl, 'image/jpeg', tileCanvas.width, tileCanvas.height);
        doc.save("map.pdf");
    });
}


