import { Location, Setting, Publisher, Play } from "../ts/IEntity";

let pData: Play[] = [];
let ogLocData: Location[] = [];
let extendedLocData: Location[] = [];
let extendedSettingData: Setting[] = [];
const maxListItems = 8;

const mapFilters = {
  "fre": {
    "typeEnabled": {
      "locations": false,
      "settings": false,
    },
    "typeCount": {
      "locations": 0,
      "settings": 0,
    }
  },
  "ger": {
    "typeEnabled": {
      "locations": false,
      "settings": false,
    },
    "typeCount": {
      "locations": 0,
      "settings": 0,
    }
  },
  "als": {
    "typeEnabled": {
      "locations": false,
      "settings": false,
    },
    "typeCount": {
      "locations": 0,
      "settings": 0,
    }
  }
}

const markerProps = {
  // Material Design Icons: https://fonts.google.com/icons
  markerIcons: {
    "locations": "book_2",
    "settings": "theater_comedy",
  },
  markerColors: {
    "fre": "rgba(0, 170, 255, 0.7)", // blue
    "ger": "rgba(240, 206, 61, 0.7)", // yellow
    "als": "rgba(255, 25, 25, 0.7)", // red
  },
  iconColor: "white",
  iconSize: [62, 83], // [width, height]
  popupAnchor: [0, -50] // [x, y]
}

const markerCluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 150,
  //todo: do not use this option now because it only shows one type of icon
  //todo: but enable it once we have implemented filters
  //disableClusteringAtZoom: 4,
});

/**
 * Create Leaflet map object and add data layers to it
 * @param locData - location data
 * @param settingData - setting data
 * @param publisherData - publisher data
 */
export function setMap(locData: Location[], settingData: Setting[], publisherData, playData: Play[]) {
    let map = L.map("map", {
      // https://github.com/mutsuyuki/Leaflet.SmoothWheelZoom
      scrollWheelZoom: false,
      smoothWheelZoom: true,
      smoothSensitivity: 1.5,
    }).setView([50, 0], 3);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: `&copy;
      <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>`
    }).addTo(map);

    // remove null values
    let [filteredLocData, filteredSettingData] = filterData(locData, settingData);

    // keeping original locData to match with settingData
    // to assign place name to settings
    ogLocData = filteredLocData as Location[];
    pData = playData;

    // extend data with publisher info
    [extendedLocData, extendedSettingData] = extendData(publisherData,
      filteredLocData, filteredSettingData);

    console.log("extendedLocData", extendedLocData);
    console.log("extendedSettingData", extendedSettingData);

    let geoJSONLocData = convertToGeoJSON(extendedLocData, "locations");
    let geoJSONSettingData = convertToGeoJSON(extendedSettingData, "settings");

    for (const key in mapFilters) {
      for (const type in mapFilters[key].typeEnabled) {
        const data = type === "locations" ? geoJSONLocData : geoJSONSettingData;
        mapFilters[key].typeCount[type] = data.features.filter((feature) => {
          return feature.properties.lang === key;
        }).length;
      }
    }

    addGeoJSONData(map, geoJSONLocData, "locations");
    addGeoJSONData(map, geoJSONSettingData, "settings");

    enableMapFilterBtns(map);
}

/**
 *
 * @param mapData - location or setting data to be filtered
 */
function filterData<T extends Location | Setting>(...mapData: T[][]): T[][] {
  return mapData.map(data => data.filter(item => item.OSMLatLon !== null));
}

function extendData(publisherData, ...mapData) {
  console.log("publisherData", publisherData)
  console.log("publisherData/mapData", mapData)
  let extendedData = mapData.map((data) => {
    return data.map((item) => {
      console.log("item", item)
      let publishers = Object.values(publisherData).filter((pub) =>
        pub.lang === item.lang && (
          (Array.isArray(item.placeId) ? item.placeId.includes(pub.placeId) : pub.placeId === item.placeId)
        )
      );
      console.log("item publishers", publishers)
      return {
        ...item,
        authorNames: publishers.map((pub) => pub.authorNames).filter(Boolean),
        playName: publishers.map((pub) => pub.playName).filter(Boolean),
        publishers: publishers.map((pub) => pub.publisherName).filter(Boolean)
      };
    });
  });

  return extendedData;
}

function convertToGeoJSON(mapData, dataType) {
  if (!["locations", "settings"].includes(dataType)) {
    throw new Error(`Invalid dataType: ${dataType}.
    Must be either "locations" or "settings".`);
  }

  console.log("mapData", mapData)

  const features = mapData.map((item) => {
    let name = item.name;

    // get place name from location data
    // as settings_data.json does not have it
    if (dataType === "settings") {
      const matchingLoc = ogLocData.find((loc) =>
      item.lang === loc.lang && item.placeId.includes(loc.placeId));
      name = matchingLoc ? matchingLoc.name : null;
    };

    // see GeoJSON spec: https://tools.ietf.org/html/rfc7946
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: item.OSMLatLon.split(",").map((coord) =>
          // needs to be reversed because GeoJSON uses [longitude, latitude]
          // and not [latitude, longitude]
          parseFloat(coord)).reverse()
      },
      properties: {
        name,
        lang: item.lang,
        playName: item.playName,
        authorNames: item.authorNames,
        publishers: item.publishers,
        settingText: dataType === "settings" ? item.settingText : null,
        time: dataType === "settings" ? item.time : null,
        type: dataType,
      }
    };
  });

  return {
    type: "FeatureCollection",
    features: features
  };
};

function createList(maxItems = maxListItems, collapseButton = null, ...data) {
  console.log("datadd", data)
  if (data.length === 1) {
    return data[0];
  }

  const listItems = data.map((item) => {
    let li = document.createElement("li");
    li.textContent = item;
    return li;
  });

  let ul = document.createElement("ul");
  ul.append(...listItems);

  if (ul.children.length > maxItems) {
    const visibleItems = Array.from(ul.children).slice(0, maxItems);
    const hiddenItems = Array.from(ul.children).slice(maxItems);

    ul.innerHTML = "";
    ul.append(...visibleItems);

    const more = document.createElement("li");
    more.innerHTML = `... and <b>${hiddenItems.length}</b> more`;
    more.style.cursor = "pointer";
    more.classList.add("more");

    ul.append(more);
  } else {
    if (collapseButton) {
      ul.append(collapseButton);
    }
  }

  return ul.outerHTML;
}

function handlePopUpList(layer, pubs) {
  const popUp = layer.getPopup();
  const moreButton = popUp._contentNode.querySelector(".more");

  if (moreButton) {
    moreButton.addEventListener("click", function(e) {
      // we need to stop propagation to prevent the popup from closing
      // because otherwise, leaflet registers a map click
      // when clicking the popup "More" button,
      // which causes the popup to close
      e.stopPropagation();
      // get lines before the list of publishers
      const popUpInitialLines = popUp.getContent().split("<ul>")[0];

      popUp.setContent(popUpInitialLines + createList(pubs, pubs.length));

      //todo: fix later
      // const collapseButton = document.createElement("p");
      // collapseButton.textContent = "Collapse";
      // collapseButton.style.cursor = "pointer";
      // collapseButton.classList.add("collapse");

      // const collapseBtnMapEl = popUp._contentNode.querySelector(".collapse");
      // collapseBtnMapEl.addEventListener("click", function() {
      //   console.log("test")
      //   popUp.setContent(createList(pubs, maxListItems));
      // });
    });
  }
}

function addGeoJSONData(map, data, type) {
  console.log("d", data)
  L.geoJSON(data, {
      pointToLayer: function(feature, latlng) {
          const markerIcon = L.IconMaterial.icon({
            icon: markerProps.markerIcons[type],
            iconColor: markerProps.iconColor,
            iconSize: markerProps.iconSize,
            popupAnchor: markerProps.popupAnchor,
            markerColor: markerProps.markerColors[feature.properties.lang] || "rgba(0, 0, 0, 0.3)"
          });

          return L.marker(latlng, {icon: markerIcon});
      },
      onEachFeature: function(feature, layer) {
        console.log("feature", feature.properties.playName)
          const playNames = feature.properties.playName
          && feature.properties.playName.length > 0
          ? feature.properties.playName : null;
          console.log("type", typeof playNames)
          const playNamesTitle = playNames && playNames.length === 1 ? "Play" : "Plays";

          console.log("authorNames", feature.properties.authorNames)
          console.log("playNames", feature.properties.playNames)

          const authorNames = feature.properties.authorNames
          && feature.properties.authorNames.length > 0
          ? feature.properties.authorNames : null;
          const authorNamesTitle = authorNames
          && (authorNames.length > 1 || authorNames.some((name: string) => name.includes(",")))
          ? "Authors" : "Author";

          const pubs = feature.properties.publishers;
          const pubTitle = pubs && pubs.length === 1 ? "Publisher" : "Publishers";

          let popUpContent = "";
          const popUpTitle = type === "locations" ? "Location" : "Setting";

          //todo: redo this when several elements
          if (type === "locations") {
            popUpContent = [
              `<b class="map-popup-title">${popUpTitle}</b>`,
              feature.properties.name
              ? `<b>Place</b>: ${feature.properties.name}` : null,
              pubs && pubs.length > 0
              ? `<b>${pubTitle}</b>: ${createList(maxListItems, null, playNames, authorNames, pubs)}` : null
            ].filter(Boolean).join("<br>");
          } else if (type === "settings") {
            popUpContent = [
              `<b class="map-popup-title">${popUpTitle}</b>`,
              feature.properties.name ?
              `<b>Place</b>: ${feature.properties.name}` : null,
              feature.properties.settingText ?
              `<b>Setting Text</b>: ${feature.properties.settingText}` : null,
              feature.properties.time ?
              `<b>Time</b>: ${feature.properties.time}` : null,
            ].filter(Boolean).join("<br>");
          }

          layer.bindPopup(popUpContent, {
            // set maxHeight for overflow:hidden to work
            maxHeight: 300,
          });

          layer.on("popupopen", function () {
            handlePopUpList(this, pubs);
          });

          markerCluster.addLayer(layer);
      }
  });

  map.addLayer(markerCluster);
}

function enableMapFilterBtns(map) {
  $(".map-filter-btn").on("click", function() {
    const type = $(this).attr("data-type");
    const lang = $(this).attr("data-lang");

    if ($(this).hasClass("active")) {
      $(this).removeClass("active");

      mapFilters[lang].typeEnabled[type] = false;

      // check if some buttons are active
      const isFiltered = $(".map-filter-btn").toArray().some((btn) => {
        return $(btn).hasClass("active");
      });

      // if all buttons are inactive, reset map filters
      if (!isFiltered) {
        resetMapFilters(map);
        return;
      }

      const layerObj = markerCluster.getLayers().filter((layer) => {
        return layer.feature.properties.type === type && layer.feature.properties.lang === lang;
      });

      layerObj.forEach((layer) => {
        markerCluster.removeLayer(layer);
      });
    } else {
      const isFiltered = $(".map-filter-btn").toArray().some((btn) => {
        return $(btn).hasClass("active");
      });

      if (!isFiltered) {
        markerCluster.clearLayers();
      }

      $(this).addClass("active");
      mapFilters[lang].typeEnabled[type] = true;

      filterMarkers(map, lang, type);
    }

    if (isOnlyOneTypeActive()) {
      markerCluster.disableClustering();
    } else {
      markerCluster.enableClustering();
    }
  });
}

function isOnlyOneTypeActive() {
  let activeTypes = new Set();

  for (const lang in mapFilters) {
    for (const type in mapFilters[lang].typeEnabled) {
      if (mapFilters[lang].typeEnabled[type]
      // don't add if there are no items of that type
      // because we don't need to significantly change the map
      // if nothing new is added to it
      // right now, applies to ger/als settings
      // as OSMLatLon is null for all of them in the data
      && mapFilters[lang].typeCount[type] > 0) {
        activeTypes.add(type);
      }
    }
  }

  console.log("only activeTypes", activeTypes)

  return activeTypes.size === 1;
}

function filterMarkers(map, lang, type) {
  const data = type === "locations" ? extendedLocData : extendedSettingData;

  const filteredData = data.filter((item) => {
    // filter by lang to avoid duplicates
    return mapFilters[item.lang].typeEnabled[type] && item.lang === lang;
  });

  console.log("options", markerCluster.options)

  const geoJSONData = convertToGeoJSON(filteredData, type);
  addGeoJSONData(map, geoJSONData, type);
};

function resetMapFilters(map) {
  console.log("resetting map filters");
  $(".map-filter-btn").removeClass("active");

  // change every value in mapFilters object to false
  for (const lang in mapFilters) {
    for (const type in mapFilters[lang].typeEnabled) {
      mapFilters[lang].typeEnabled[type] = false;
    }
  }

  console.log("markerCluster", markerCluster.options)

  markerCluster.clearLayers();
  markerCluster.enableClustering();

  addGeoJSONData(map, convertToGeoJSON(extendedLocData, "locations"), "locations");
  addGeoJSONData(map, convertToGeoJSON(extendedSettingData, "settings"), "settings");
}