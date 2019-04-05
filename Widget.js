define([
      'dojo/_base/declare',
      'dojo/_base/array',
      'esri/dijit/LocateButton',
      'esri/tasks/locator',
      'esri/symbols/PictureMarkerSymbol',
      'esri/InfoTemplate',
      'esri/lang',
      'esri/dijit/Search',
      'dojo/_base/lang',
      'dojo/on',
      'dojo/dom',
      'dijit/registry',
      'dojo/dom-construct',
      'dojo/query',
      'dojox/widget/Standby',
      'jimu/BaseWidget',
      'esri/config',
      'esri/Color',
      'esri/layers/GraphicsLayer',
      'esri/layers/FeatureLayer',
      'esri/renderers/UniqueValueRenderer',
      'esri/graphicsUtils',
      'esri/toolbars/draw',
      'esri/graphic',
      'esri/symbols/SimpleMarkerSymbol',
      'esri/symbols/SimpleLineSymbol',
      'esri/tasks/FeatureSet',
      'esri/tasks/ClosestFacilityTask',
      'esri/tasks/ClosestFacilityParameters',
      'esri/tasks/ClosestFacilitySolveResult',
      'esri/tasks/NATypes',
      './widgets/ClosestFacility/PolylineAnimation.js'
    ],
    function(declare, array, LocateButton, Locator, PictureMarkerSymbol, InfoTemplate, esriLang, Search, lang, on, dom, registry, domConstruct, query,
      Standby,
      BaseWidget,
      esriConfig,
      Color,
      GraphicsLayer, FeatureLayer,
      UniqueValueRenderer,
      graphicsUtils, Draw,
      Graphic,
      SimpleMarkerSymbol, SimpleLineSymbol,
      FeatureSet,
      ClosestFacilityTask, ClosestFacilityParameters, ClosestFacilitySolveResult, NATypes,
      PolylineAnimation) {

      /*     require(["/WAB_CF/widgets/ClosestFacility/PolylineAnimation.js"], function() {
              console.log("Load animation class");
          }); */
      var m_lyrResultRoutes, m_lyrAllFacilities, m_lyrEvents, m_lyrBarriers, _layerPunto;
      var m_drawToolbar;

      var m_aryResultSymbolInfos; // Symbols for ranked results

      // Event handlers needing later removal
      var m_zoomToFacilities, m_clickDrawEvent, m_clickDrawBarrier,
        m_clickSolve, m_clickClear, m_changeFacilitiesCount,
        m_chkLimitTravelTime, m_numMaxTravelTime;
      // Closest Facility solver objects
      var m_closestFacilityTask;
      // Busy indicator handle
      var m_busyIndicator;
      // filtros
      var _layer, _layerRutas, _layerPuntos, sources;
      var _definitionExpression;
      var m_clickLocate, m_clickSearch, m_alumbrado;
      var geoLocate, search, highlightSymbol, highlightGraphic;

      //To create a widget, you need to derive from BaseWidget.
      return declare([BaseWidget], {
        // Custom widget code goes here

        baseClass: 'jimu-widget-customwidget'

          //this property is set by the framework when widget is loaded.
          ,
        name: 'ClosestFacilityWidget'

          //methods to facilitate communication with app container:

          ,
        postCreate: function() {
            this.inherited(arguments);
            console.log('postCreate');

            // m_lyrAllFacilities = this.map.getLayer("Puntos_Rutas_Turis_All_Info_2052");
            // m_zoomToFacilities = m_lyrAllFacilities.on('update-end', this.zoomToFacilities);


            m_lyrResultRoutes = new GraphicsLayer();
            m_lyrEvents = new GraphicsLayer();
            // m_lyrBarriers = new GraphicsLayer();

            var slsDefault = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([32, 32, 32]), 2);
            var resultRenderer = new UniqueValueRenderer(slsDefault, this.config.symbology.routeRenderer.field1);
            for (var i = 0; i < this.config.symbology.routeRenderer.uniqueValueInfos.length; i++) {
              var info = this.config.symbology.routeRenderer.uniqueValueInfos[i];
              var sls = new SimpleLineSymbol(info.style, info.sym.color, info.sym.width);
              resultRenderer.addValue(info.value, sls);
            }
            m_lyrResultRoutes.setRenderer(resultRenderer);

            m_drawToolbar = new Draw(this.map);
            var sms = new SimpleMarkerSymbol(this.config.symbology.eventSymbol);
            m_drawToolbar.setMarkerSymbol(sms);
            var sls = new SimpleLineSymbol(this.config.symbology.barrierSymbol);
            m_drawToolbar.setLineSymbol(sls);
            m_drawToolbar.on("draw-complete", lang.hitch(this, this.onDrawEvent));

            m_closestFacilityTask = new ClosestFacilityTask(this.config.closestFacilitySvc.url);

            // filtros
            _layer = this.map.getLayer("Puntos_Rutas_Turis_All_Info_2052");
            _layerRutas = this.map.getLayer("Mapa_Rutas_8583");
            _layerPuntos = this.map.getLayer("Puntos_Rutas_Turis_All_Info_2052_8000");

            _definitionExpression = _layer.defaultDefinitionExpression;
            _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");

            // Alumbrado
            highlightSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0,255,255],0.25), 4.5);

            // Buscador
            sources = [{
              locator: new Locator("//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"),
              singleLineFieldName: "SingleLine",
              outFields: ["Addr_type"],
              localSearchOptions: {
                minScale: 300000,
                distance: 50000
              },
              highlightSymbol: new PictureMarkerSymbol("https://image.flaticon.com/icons/svg/1281/1281225.svg", 16, 16).setOffset(9, 18)
              // ${folderUrl}images/iconSearch.png
            }]

          }

          ,
        startup: function() {
            this.inherited(arguments);
            console.log('startup');

            // Add ranks and colors from config
            // var rankNumbers = dom.byId("trRankNumbers");
            // var rankColors = dom.byId("trRankColors");
            // for (var i = 0; i < this.config.symbology.routeRenderer.uniqueValueInfos.length; i++) {
            //   var info = this.config.symbology.routeRenderer.uniqueValueInfos[i];
            //   var className = this.getRankSymbolDomClassName(info.value);
            //   var aryColor = info.sym.color;

              // var tdRankNumber = '<td class="' + className + '" ' +
              //   'style="text-align:center;">' + info.value + '</td>';
              // domConstruct.place(tdRankNumber, rankNumbers);

            //   var tdRankColor = '<td class="' + className + '" ' +
            //     'style="background-color:rgba(' +
            //     aryColor[0] + ',' + aryColor[1] + ',' + aryColor[2] + ',' + aryColor[3] + ')' +
            //     ';width:15px;height:15px;">&nbsp;</td>'
            //   domConstruct.place(tdRankColor, rankColors);
            // }

            // Create busy indicator
            m_busyIndicator = new Standby({
              target: "busyIndicator"
            });
            document.body.appendChild(m_busyIndicator.domNode);
            m_busyIndicator.startup();

            // LocateButton
            geoLocate = new LocateButton({
              map: this.map,
              highlightLocation: true,
              scale:36112,
              graphicsLayer:m_lyrEvents,
            }, 'LocateButton');

            // Search
            search = new Search({
              map: this.map,
              showInfoWindowOnSelect:false,
              zoomScale:36112,
              sources: sources,
              graphicsLayer:m_lyrEvents,
            }, "search");

          }

          ,
        onOpen: function() {
          console.log('onOpen');

          this.map.addLayer(m_lyrAllFacilities);
          this.map.addLayer(m_lyrResultRoutes);
          // this.map.addLayer(m_lyrBarriers);
          this.map.addLayer(m_lyrEvents);

          m_clickDrawEvent = on(dom.byId("btnDrawEvent"), "click", this.onClickDrawEvent);
          // m_clickDrawBarrier = on(dom.byId("btnDrawBarrier"), "click", this.onClickDrawBarrier);
          m_clickSolve = on(dom.byId("btnSolve"), "click", lang.hitch(this, this.onClickSolve));
          m_clickClear = on(dom.byId("btnClear"), "click", lang.hitch(this, this.onClickClear));
          m_chkLimitTravelTime = on(dom.byId("chkLimitTravelTime"), "change", lang.hitch(this, this.onCheckLimitTravelTime));
          m_numMaxTravelTime = on(dom.byId("numMaxTravelTime"), "change", lang.hitch(this, this.onChangeMaxTravelTime));

          var numFacilities = dom.byId("numFacilities");
          m_changeFacilitiesCount = on(numFacilities, "change", lang.hitch(this, this.onChangeFacilitiesCount));
          on.emit(numFacilities, "change", {
              bubbles: true,
              cancelable: true
              });
              // modo de viaje
          var modoDeViaje = dom.byId("modoDeViaje");
          m_changeModo = on(modoDeViaje, "change", lang.hitch(this, this.onChangeModoViaje));
          on.emit(modoDeViaje, "change", {
            bubbles: true,
            cancelable: true
          });

          // LocateButton
          m_clickLocate = on(dom.byId("LocateButton"), "click", lang.hitch(this, this.localizarClick));

          // Search
          m_clickSearch = on(dom.byId("search"), "click", lang.hitch(this, this.BuscarClick));

          // Alumbrado
          m_alumbrado = on(m_lyrResultRoutes, "mouse-over", lang.hitch(this, this.Alumbrar));

            }

            ,
            onClose: function() {
              console.log('onClose');

              // this.map.removeLayer(m_lyrBarriers);
              this.map.removeLayer(m_lyrEvents);
              this.map.removeLayer(m_lyrResultRoutes);

              m_clickDrawEvent.remove();
              // m_clickDrawBarrier.remove();
              m_clickSolve.remove();
              m_clickClear.remove();
              m_changeFacilitiesCount.remove();
              m_chkLimitTravelTime.remove();
              m_numMaxTravelTime.remove();
            }

            // onMinimize: function(){
            //   console.log('onMinimize');
            // },

            // onMaximize: function(){
            //   console.log('onMaximize');
            // },

            // onSignIn: function(credential){
            //   /* jshint unused:false*/
            //   console.log('onSignIn');
            // },

            // onSignOut: function(){
            //   console.log('onSignOut');
            // }

            // onPositionChange: function(){
            //   console.log('onPositionChange');
            // },

            // resize: function(){
            //   console.log('resize');
            // }

            //methods to communication between widgets:

            // Other methods
            ,
            zoomToFacilities: function(event) {
              var extent = graphicsUtils.graphicsExtent(event.target.graphics);
              event.target.getMap().setExtent(extent);
              m_zoomToFacilities.remove();
            }
            /*         ,zoomToResults: function(lyrResults) {
                        var extent = graphicsUtils.graphicsExtent(lyrResults.graphics);
                        this.map.setExtent(extent);
                    } */

            ,
            onClickDrawEvent: function() {
              console.log("Draw Event Click");
              m_drawToolbar.activate(Draw.POINT);
            },
            // onClickDrawBarrier: function() {
            //   console.log("Draw Barrier");
            //   m_drawToolbar.activate(Draw.POLYLINE);
            // }
            //
            // ,
            onDrawEvent: function(event) {
              console.log("Draw Event Complete");
              m_drawToolbar.deactivate();

              var geom = event.geometry;
              if (event.geometry.type === "point") {
                var symbol = event.target.markerSymbol;
                var graphic = new Graphic(geom, symbol);
                m_lyrEvents.add(graphic);
                this.checkSolveEnabledState();
              };
              // else if (event.geometry.type === "polyline") {
              //   var symbol = event.target.lineSymbol;
              //   var graphic = new Graphic(geom, symbol);
              //   m_lyrBarriers.add(graphic);
              // }
            }

            ,
            onClickSolve: function() {
              this.map.graphics.clear();
              console.log("Solve");
              console.log(this.map.itemInfo);
              var params = new ClosestFacilityParameters();

              var facilities = this.fs4gl(m_lyrAllFacilities);
              params.facilities = facilities;

              var events = this.fs4gl(m_lyrEvents);
              params.incidents = events;

              // var barriers = this.fs4gl(m_lyrBarriers);
              // params.polylineBarriers = barriers;

              params.defaultCutoff = (dom.byId("chkLimitTravelTime").checked ?
                dom.byId("numMaxTravelTime").value :
                Number.MAX_VALUE);
              params.defaultTargetFacilityCount = numFacilities.value;
              params.outSpatialReference = this.map.spatialReference;
              params.outputLines = NATypes.OutputLine.TRUE_SHAPE;
              params.returnFacilities = true;
              params.returnDirections=true;


              m_busyIndicator.show();
              dom.byId("btnSolve").disabled = "disabled";

              m_closestFacilityTask.solve(params,
                lang.hitch(this, this.onSolveSucceed),
                function(err) {
                  console.log("Solve Error");
                  m_busyIndicator.hide();
                  dom.byId("btnSolve").disabled = "";
                  alert(err.message + ": " + err.details[0]);
                });
            }

            ,
            onSolveSucceed: function(result) {
              // panel informacion
              array.forEach(result.routes, function(route, index){
                var attr = array.map(result.directions[index].features, function(feature){
                  return feature.attributes.text;
                });
                var infoTemplate = new InfoTemplate("Attributes", "${*}");

                route.setInfoTemplate(infoTemplate);
                route.setAttributes(attr);
              });
              // fin panel infomacion

              console.log("Solve Callback");
              m_busyIndicator.hide();
              dom.byId("btnSolve").disabled = "";


              var routes = result.routes;
              routes.sort(lang.hitch(this, function(g1, g2) {
                var rank1 = g1.attributes[this.config.symbology.routeZOrderAttrName];
                var rank2 = g2.attributes[this.config.symbology.routeZOrderAttrName];
                // Reverse sort
                return rank2 - rank1;
              }));
              m_lyrResultRoutes.clear();
              for (var i = 0; i < routes.length; i++) {
                var g = routes[i];
                // Set animation here?
                var pla = new PolylineAnimation({
                  graphic: g,
                  graphicsLayer: m_lyrResultRoutes,
                  duration: this.config.symbology.animateRoutesDuration
                });
                pla.animatePolyline();
              };
              // Zoom to results?
              // graphicsUtil.graphicsExtent() not working properly
              /*              if (dom.byId("chkZoomToResults").checked)
                               this.zoomToResults(m_lyrResultRoutes); */
              // Alumbrado
              dom.byId("directionsDiv").innerHTML = "Pasa el cursor sobre la ruta para ver las direcciones.";
            }

            ,
            onClickClear: function() {
              console.log("Clear");
              m_lyrEvents.clear();
              // m_lyrBarriers.clear();
              m_lyrResultRoutes.clear();
              this.checkSolveEnabledState();
              geoLocate.clear();
              this.map.graphics.clear();
            }

            ,
            onChangeFacilitiesCount: function(event) {
              console.log("Change Facilities Count: " + event.currentTarget.value);
              var count = event.currentTarget.value;
              for (var i = 0; i < this.config.symbology.routeRenderer.uniqueValueInfos.length; i++) {
                var className = this.getRankSymbolDomClassName(i + 1);
                if (i + 1 <= count)
                  query("." + className).style("visibility", "visible");
                else
                  query("." + className).style("visibility", "hidden");
              }
            }

            ,
            getRankSymbolDomClassName: function(rank) {
              return "rank" + rank;
            }

            ,
            checkSolveEnabledState: function() {
              dom.byId("btnSolve").disabled = (m_lyrEvents.graphics.length > 0 ? "" : "disabled");
              // LocateButton
            },
            onCheckLimitTravelTime: function(event) {
              dom.byId("numMaxTravelTime").disabled = (event.target.checked ? "" : "disabled");
            },
            onChangeMaxTravelTime: function(event) {
              console.log("Change Max Travel Time");
              // Check for valid number
              if (!this.isPositiveInt(event.target.value))
                event.target.value = event.target.oldValue;
              // Update old value
              else
                event.target.oldValue = event.target.value;
            },
            isPositiveInt: function(str) {
              // Taken from StackOverflow post, http://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
              var n = ~~Number(str);
              return String(n) === str && n >= 0;
            }

            ,
            fs4gl: function(lyrGraphics) {
              // Some facilities datasets with lots of attributes seem to confuse the solver. Remove attributes here before solving.
              var fs = new FeatureSet();
              var ga = [];
              for (var i = 0; i < lyrGraphics.graphics.length; i++) {
                var g = new Graphic(lyrGraphics.graphics[i].geometry);
                ga.push(g);
              }
              fs.features = ga;
              // fs.features = lyrGraphics.graphics;
              return fs;
            },

            // Los filtros  de los botones

            _onClickLitoral: function() {
              if (_definitionExpression === "Tipo_Ruta='Litoral'") {
                _definitionExpression = _layer.defaultDefinitionExpression;
                _layer.setDefinitionExpression(_layer.defaultDefinitionExpression);
                _layerRutas.setDefinitionExpression(_layerRutas.defaultDefinitionExpression);
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Montaña'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'") {
                _definitionExpression = "Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64'");
              } else if (_definitionExpression === "Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='24' or OBJECTID='51'");
              } else if (_definitionExpression === "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='24' or OBJECTID='51'");
              } else {
                _definitionExpression = "Tipo_Ruta='Litoral'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerPuntos.setDefinitionExpression("OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              };
            },

            _onClickMontaña: function() {
              if (_definitionExpression === "Tipo_Ruta='Montaña'") {
                _definitionExpression = _layer.defaultDefinitionExpression;
                _layer.setDefinitionExpression(_layer.defaultDefinitionExpression);
                _layerRutas.setDefinitionExpression(_layerRutas.defaultDefinitionExpression);
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'") {
                _definitionExpression = "Tipo_Ruta='Litoral'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerPuntos.setDefinitionExpression("OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='24' or OBJECTID='51'");
              } else if (_definitionExpression === "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression(" OBJECTID='24' or OBJECTID='51'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else {
                _definitionExpression = "Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64'");
              };
            },

            _onClickHistorica: function() {
              if (_definitionExpression === "Tipo_Ruta='Histórica'") {
                _definitionExpression = _layer.defaultDefinitionExpression;
                _layer.setDefinitionExpression(_layer.defaultDefinitionExpression);
                _layerRutas.setDefinitionExpression(_layerRutas.defaultDefinitionExpression);
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression(" OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral'");
                _layerPuntos.setDefinitionExpression(" OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Montaña'") {
                _definitionExpression = "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='24' or OBJECTID='51'");
              } else if (_definitionExpression === "Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='24' or OBJECTID='51' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else if (_definitionExpression === "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña' or Tipo_Ruta='Histórica'") {
                _definitionExpression = "Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'";
                _layer.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Litoral' or Tipo_Ruta='Montaña'");
                _layerPuntos.setDefinitionExpression("OBJECTID='52' or OBJECTID='64' or OBJECTID='1' or OBJECTID='8' or OBJECTID='10' or OBJECTID='19' or OBJECTID='20'");
              } else {
                _definitionExpression = "Tipo_Ruta='Histórica'";
                _layer.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerRutas.setDefinitionExpression("Tipo_Ruta='Histórica'");
                _layerPuntos.setDefinitionExpression("OBJECTID='24' or OBJECTID='51'");
              };
            },

            // modo de viaje
            onChangeModoViaje: function(event) {
              console.log("Change modo " + event.currentTarget.value);
              var modod = event.currentTarget.value;
              if (modod === "1") {
                m_lyrAllFacilities = this.map.getLayer("Puntos_Rutas_Turis_All_Info_2052_8000");
              } else {
                m_lyrAllFacilities = this.map.getLayer("Puntos_Rutas_Turis_All_Info_2052");
              };
              console.log(m_lyrAllFacilities);
            },

            // LocateButton
            localizarClick: function(events){
              var geom = event.geometry;
              // var symbol =  new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10,
              //   new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              //     new Color([255, 0, 0]), 1),
              //   new Color([0, 255, 0, 0.25]));
              var graphic = new Graphic(geom);
              m_lyrEvents.add(graphic);
              this.checkSolveEnabledState();
              geoLocate.startup();
            },

            // search
            BuscarClick: function(events){
              var geom = event.geometry;
              // var symbol =  new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10,
              //   new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              //     new Color([255, 0, 0]), 1),
              //   new Color([0, 255, 0, 0.25]));
              var graphic = new Graphic(geom);
              m_lyrEvents.add(graphic);
              this.checkSolveEnabledState();
              search.startup();
            },

            // Alumbrar
          Alumbrar: function(events){
              this.map.graphics.clear();
              highlightGraphic = new Graphic(events.graphic.geometry,highlightSymbol);
              this.map.graphics.add(highlightGraphic);
              dom.byId("directionsDiv").innerHTML = esriLang.substitute(events.graphic.attributes,"${*}");
            },

          });
      });
