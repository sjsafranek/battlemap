
// returns true if every pixel's uint32 representation is 0 (or "blank")
// https://stackoverflow.com/questions/17386707/how-to-check-if-a-canvas-is-blank
function isCanvasBlank(canvas) {
    const context = canvas.getContext('2d');

    const pixelBuffer = new Uint32Array(
        context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );

    return !pixelBuffer.some(color => color !== 0);
}





L.PaintLayer = L.CanvasLayer.extend({

    initialize: function(options) {
        this._painting = false;
        this._mouseDown = false;

        this.settings = {
            lineWidth: 4,
            strokeStyle: "#000000",
            erase: false
        }

        L.CanvasLayer.prototype.initialize.call(this, options);

        this.delegate(this);

        this.features = [this._makeFeature()];
    },

    clear: function() {
        this.features = [this._makeFeature()];
        this.drawLayer();
    },

    _makeFeature: function() {
        var settings = JSON.parse(JSON.stringify(this.settings));
        return {
            erase: settings.erase,
            lineWidth: settings.lineWidth,
            strokeStyle: settings.strokeStyle,
            path: []
        }
    },

    onAdd: function(map) {
        var self = this;

        L.CanvasLayer.prototype.onAdd.call(this, map);

        this._map
            .on('mousedown', function(event) {
                if (self._painting) {
                    self._mouseDown = true;
                }
            })
            .on('mouseup', function(event) {
                if (self._painting) {
                    self._mouseDown = false;
                    self.features[self.features.length-1].path.length &&
                        self.features.push(self._makeFeature());
                }
            })
            .on('mousemove', function(event) {
                if (self._painting && self._mouseDown) {
                    self.features[self.features.length-1].path.push(event.latlng);
                    self.drawLayer();
                }
            });

    },

    onDrawLayer: function(event) {
        var map = event.layer._map;
        var ctx = event.canvas.getContext('2d');
        ctx.clearRect(0, 0, event.canvas.width, event.canvas.height);

        for (var i = 0; i < this.features.length; i++) {
            let feature = this.features[i];
            let last = null;

            if (!feature.path.length) {
                continue;
            }

            // get scaling for zoom
            var lineWidth = feature.lineWidth * this._map.options.crs.scale(this._map.getZoom());

            // Toggle erasing
            // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
            ctx.globalCompositeOperation = (feature.erase ? 'destination-out' : 'source-over');

            // Draw path
            ctx.beginPath();
            ctx.lineJoin = "round";
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = feature.strokeStyle;
            for (var j=0; j<feature.path.length; j++) {
                var latlng = feature.path[j];
                var dot = map.latLngToContainerPoint(latlng);
                j ?
                    ctx.lineTo(dot.x, dot.y) :
                    ctx.moveTo(dot.x, dot.y)
            }
            // ctx.closePath();
            ctx.stroke();
            //.end

            // draw circle at last point
            ctx.beginPath();
            var dot = map.latLngToContainerPoint(feature.path[0]);
            ctx.arc(dot.x, dot.y, lineWidth/2, 0, 2 * Math.PI);
            ctx.fillStyle = feature.strokeStyle;
            ctx.fill();

            // draw circle at first point
            ctx.beginPath();
            var dot = map.latLngToContainerPoint(feature.path[feature.path.length-1]);
            ctx.arc(dot.x, dot.y, lineWidth/2, 0, 2 * Math.PI);
            ctx.fillStyle = feature.strokeStyle;
            ctx.fill();


            // // Check if canvas is empty
            // // Clean up artifacts
            // if (isCanvasBlank(event.canvas) && this.features.length > 1) {
            //     this.features = [this._makeFeature()];
            //     this.onDrawLayer(event);
            //     return;
            // }
        }
    },

    enable: function() {
        this._painting = true;
    },

    disable: function() {
        this._painting = false;
    },

    enableErase: function() {
        this.settings.erase = true;
        this.features[this.features.length-1].erase = true;
    },

    disableErase: function() {
        this.settings.erase = false;
        this.features[this.features.length-1].erase = false;
    },

    applySettings: function(settings) {
        for (var i in settings) {
            this.settings[i] = settings[i];
            this.features[this.features.length-1][i] = settings[i];
        }
    }

});

L.paintLayer = function () {
    return new L.PaintLayer();
};





var App = function(mapId) {
    var self = this;

    // container for layers
    this.layers = {
        imageLayer: null,
        gridLayer: null
    };

    // initialize map
	this.map = L.map(mapId, {
		crs: L.CRS.Simple,
        minZoom: -5
	});

    //
    this.map.on('contextmenu', function(e) {
        self.addMarker(e);
    });

    // enableFileDrop(
    //     $(this.map._container),
    //     function(file) {
    //         self.onFileUpload(file);
    //     }
    // );

    // initialize paint layer
    this.paintLayer = L.paintLayer();
    this.paintLayer.addTo(this.map);

    this._addControls();

    // initialize grid
	this.map.fitBounds([[0, 0], [2000, 2000]]);
    this.drawGrid();
    this.map.setZoom(this.map.getZoom()+1)
}

App.prototype.clearPainting = function() {
    this.paintLayer.clear();
}

App.prototype._addControls = function() {
    var self = this;

    // resources
    this.elements = {

        $cellSizeInput: $('<input>', {
                id: 'cellSize',
                type: 'number',
                min: 5,
                max: 1000,
                value: 100
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.onCellSizeChange(e);
            }),

        $fileUploadInput: $('<input>', {
                id: 'fileUpload',
                type: 'file',
                accept: 'image/png, image/jpeg'
            })
            .addClass('form-control-file')
            .on('change', function(e) {
                self.onFileUpload(this.files[0]);
            }),

        $enablePaintingModeInput: $('<input>', {
                id: 'enablePainting',
                type: 'checkbox'
            })
            .addClass('form-check-input')
            .on('change', function(e) {
                $(this).is(':checked') ?
                    self.enablePainting() : self.disablePainting();
            }),

        $lineWidthInput: $('<input>', {
                id: 'lineWidth',
                type: 'number',
                step: 2,
                min: 2,
                max: 64,
                value: self.paintLayer.settings.lineWidth
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.paintLayer.applySettings({
                    'lineWidth': parseInt(this.value)
                });
            }),

        $strokeColorInput: $('<input>', {
                id: 'strokeColor',
                type: 'color',
                value: self.paintLayer.settings.strokeStyle
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.paintLayer.applySettings({
                    'strokeStyle': this.value
                });
            }),

        $eraseDrawingInput: $('<input>', {
                id: 'eraseDrawing',
                type: 'checkbox'
            })
            .addClass('form-check-input')
            .on('change', function(e) {
                $(this).is(':checked') ?
                    self.paintLayer.enableErase() : self.paintLayer.disableErase();
            }),

    };

    this.controls = L.control({position: 'topright'});
    this.controls.onAdd = function(map) {
        return $('<div>')
            .addClass('leaflet-control controls')
            .on('contextmenu', function(event) {
                event.stopPropagation();
            })
            .append(

                $('<div>')
                    .addClass('form-group mb-2')
                    .append(
                        $('<label>', {for: 'fileUpload'})
                            .addClass('form-check-label')
                            .append('Background Image'),
                        self.elements.$fileUploadInput
                    ),

                $('<div>')
                    .addClass('form-group row mb-2')
                    .append(
                        $('<label>', {for: 'cellSize'})
                            .addClass('col-sm-4 col-form-label')
                            .append('Grid Size'),
                        $('<div>')
                            .addClass('col-sm-8')
                            .append(
                                self.elements.$cellSizeInput
                            )
                    ),

                $('<div>')
                    .addClass('form-group mb-2 form-check form-check-inline')
                    .append(
                        self.elements.$enablePaintingModeInput,
                        $('<label>', {for: 'enablePainting'})
                            .addClass('form-check-label')
                            .append('Draw mode')
                    ),

                $('<div>')
                    .addClass('draw-controls pl-4')
                    .append(
                        $('<div>')
                            .addClass('form-group row mb-2')
                            .append(
                                $('<label>', {for: 'lineWidth'})
                                    .addClass('col-sm-3 col-form-label')
                                    .append('Width'),
                                $('<div>')
                                    .addClass('col-sm-9')
                                    .append(
                                        self.elements.$lineWidthInput
                                    )
                            ),
                        $('<div>')
                            .addClass('form-group row mb-2')
                            .append(
                                $('<label>', {for: 'strokeColor'})
                                    .addClass('col-sm-3 col-form-label')
                                    .append('Color'),
                                $('<div>')
                                    .addClass('col-sm-9')
                                    .append(
                                        self.elements.$strokeColorInput
                                    )
                            ),
                        $('<div>')
                            .addClass('form-group mb-2 form-check form-check-inline')
                            .append(
                                self.elements.$eraseDrawingInput,
                                $('<label>', {for: 'eraseDrawing'})
                                    .addClass('form-check-label')
                                    .append('Erase')
                            )
                    )
                    .hide()

            )[0];
    };
    this.controls.addTo(this.map);
    L.preventPropogation(this.controls, this.map);
}

App.prototype.onFileUpload = function(file) {
    var self = this;

    // create file reader
    let reader = new FileReader();

    // parse file listener
    reader.onload = function(e) {
        // create image
        let img = new Image();
        img.src = e.target.result;

        // drawing of the test image - img1
        img.onload = function() {
            // load image onto map
            var bounds = [[0,0], [img.height, img.width]];
            var imageLayer = L.imageOverlay(e.target.result, bounds);
            imageLayer.addTo(self.map);

            // cleanup old layer
            self.imageLayer && self.imageLayer.remove();

            // add new layer
            self.imageLayer = imageLayer;

            self.map.fitBounds(bounds);

            // draw battle grid
            self.drawGrid(bounds);
        };
    }

    // read file
    reader.readAsDataURL(file);
}

App.prototype.onCellSizeChange = function(e) {
    if (!this.imageLayer) {
        this.drawGrid();
        return;
    }
    var bbox = this.imageLayer.getBounds();
    this.drawGrid([
        [bbox._southWest.lat, bbox._southWest.lng],
        [bbox._northEast.lat, bbox._northEast.lng]
    ]);
}

App.prototype.drawGrid = function(bounds) {
    let cellSize = parseInt(this.elements.$cellSizeInput.val());

    bounds = bounds || [[0,0],[cellSize*20, cellSize*20]];

    // cleanup old layer
    this.gridLayer && this.gridLayer.remove();

    let canvas = $('<canvas>')[0];
    let context = canvas.getContext('2d');
    canvas.height = bounds[1][0];
    canvas.width  = bounds[1][1];

    let nX = Math.floor(canvas.width / cellSize) - 2;
    let nY = Math.floor(canvas.height / cellSize) - 2;
    let pX = canvas.width - nX * cellSize;
    let pY = canvas.height - nY * cellSize;

    let pL = 0;
    let pT = 0;
    let pR = canvas.width - nX * cellSize - (pX);
    let pB = canvas.height - nY * cellSize - (pY);

    context.strokeStyle = 'black';
    context.lineWidth = 2;
    // context.setLineDash([5, 3])
    // context.setLineDash([10, 8])
    context.beginPath();

    for (var x = pL; x <= canvas.width - pR; x += cellSize) {
        context.moveTo(x, pT);
        context.lineTo(x, canvas.height - pB);
    }
    for (var y = pT; y <= canvas.height - pB; y += cellSize) {
        context.moveTo(pL, y);
        context.lineTo(canvas.width - pR, y);
    }
    context.stroke();

    // Populate cell names
    var cx = 0;
    for (var x = pL; x <= canvas.width - pR; x += cellSize) {
        var cy = 0;
        for (var y = pT; y <= canvas.height - pB; y += cellSize) {
            context.font = "14px Arial";
            // context.fillText(cx +','+cy, x+4, y-4);
            context.fillText(cx +','+cy, x+4, y-cellSize+16);
            cy++;
        }
        cx++;
    }

    // cleanup old layer
    this.gridLayer && this.gridLayer.remove();
    var gridLayer = L.imageOverlay(canvas.toDataURL(), bounds);
    gridLayer.addTo(this.map);
    this.gridLayer = gridLayer;
}

App.prototype.addMarker = function(e) {
    var self = this;
    this._count = this._count || 0;
    this._count++;

    var iconSettings = {
		mapIconUrl: `
            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 149 178"><path fill="{mapIconColor}" stroke="#FFF" stroke-width="6" stroke-miterlimit="10" d="M126 23l-6-6A69 69 0 0 0 74 1a69 69 0 0 0-51 22A70 70 0 0 0 1 74c0 21 7 38 22 52l43 47c6 6 11 6 16 0l48-51c12-13 18-29 18-48 0-20-8-37-22-51z"/>
                <circle fill="{mapIconColorInnerCircle}" cx="74" cy="75" r="61"/>
                <g>
                    <circle fill="#FFF" cx="74" cy="75" r="{pinInnerCircleRadius}"/>
                    <text x="50%" y="50%" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dx="-0.05em" dy="0.1em" font-size="65px">
                        ` + this._count + `
                    </text>
                </g>
            </svg>
        `,
		mapIconColor: randomColor(),
		mapIconColorInnerCircle: '#fff',
		pinInnerCircleRadius: 48
	};

    let cellSize = parseInt(this.elements.$cellSizeInput.val());
    let latlng = e.latlng;
    latlng.lat = latlng.lat - (latlng.lat % cellSize) + (cellSize/2);
    latlng.lng = latlng.lng - (latlng.lng % cellSize) + (cellSize/2);

    let marker = L.marker(
        latlng,
        {
            draggable: true,
            icon: L.divIcon({
                className: "leaflet-data-marker",
                iconAnchor  : [15, 30],
                iconSize    : [30, 30],
                popupAnchor : [0, -28],
                html: L.Util.template(iconSettings.mapIconUrl, iconSettings)
            })
        });

    marker
        .on('contextmenu', function(event) {
            event.originalEvent.stopPropagation();
            this.remove();
        })
        .on('dragend', function(event) {
            let cellSize = parseInt(self.elements.$cellSizeInput.val());
            let latlng = this.getLatLng();
            latlng.lat = latlng.lat - (latlng.lat % cellSize) + (cellSize/2);
            latlng.lng = latlng.lng - (latlng.lng % cellSize) + (cellSize/2);
            this.setLatLng(latlng);
        });

    marker.addTo(this.map);
}

App.prototype.enablePainting = function() {
    $('.draw-controls').show();
    this.paintLayer.enable();
    this.map.touchZoom.disable();
    this.map.doubleClickZoom.disable();
    this.map.scrollWheelZoom.disable();
    this.map.dragging.disable();
}

App.prototype.disablePainting = function() {
    $('.draw-controls').hide();
    this.paintLayer.disable();
    this.map.touchZoom.enable();
    this.map.doubleClickZoom.enable();
    this.map.scrollWheelZoom.enable();
    this.map.dragging.enable();
}
