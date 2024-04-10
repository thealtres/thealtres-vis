import { Location, Setting, Play } from "../ts/IEntity";

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
  iconSize: [35, 45], // [width, height]
  popupAnchor: [0, -50] // [x, y]
}

const markerCluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 25,
});

/**
 * Create Leaflet map object and add data layers to it
 * @param locData - location data
 * @param settingData - setting data
 * @param publisherData - publisher data
 */
export function setMap(locData: Location[], settingData: Setting[], publisherData) {
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

    // extend data with publisher info
    [extendedLocData, extendedSettingData] = extendData(publisherData,
      filteredLocData, filteredSettingData);

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
  let extendedData = mapData.map((data) => {
    return data.map((item) => {
      let publishers = Object.values(publisherData).filter((pub) =>
        pub.lang === item.lang && (
          (Array.isArray(item.placeId) ? item.placeId.includes(pub.placeId) : pub.placeId === item.placeId)
        )
      );

      let playData = {};
      publishers.forEach((pub, index) => {
        let playKey = `play${index + 1}`;
        playData[playKey] = {
          playName: pub.playName || null,
          playDate: pub.playDate || null,
          authorNames: pub.authorNames || null,
          publisherName: pub.publisherName || null,
          settingTime: item.time || null,
          settingText: item.settingText || null,
        };
      });

      return {
        ...item,
        playData,
      };
    });
  });

  return extendedData;
}

/**
 * Converts an array of Location or Setting objects to GeoJSON format.
 * @param mapData - The array of Location or Setting objects.
 * @param dataType - The type of data being converted. Must be either "locations" or "settings".
 * @returns The converted GeoJSON object.
 * @throws Error if an invalid dataType is provided.
 */
function convertToGeoJSON(mapData: Location[] | Setting[], dataType: string) : any {
  if (!["locations", "settings"].includes(dataType)) {
    throw new Error(`Invalid dataType: ${dataType}.
    Must be either "locations" or "settings".`);
  }

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
        playData: item.playData,
        type: dataType,
      }
    };
  });

  return {
    type: "FeatureCollection",
    features: features
  };
};

/**
 * Creates a list element from an array of data.
 * If the data array has only one item, it returns that item.
 * If the number of items in the data array exceeds the maximum number of items specified, it truncates the list and adds a "more" item.
 * @param data - The array of data to create the list from.
 * @param maxItems - The maximum number of items to display in the list. Defaults to `maxListItems`.
 * @returns The HTML string representing the created list.
 */
function createList(data, maxItems = maxListItems) : string {
  if (data.length === 1) {
    return data[0];
  }

  const listItems = data.map((item) => {
    let li = document.createElement("li");
    li.innerHTML = item;
    return li;
  });

  let ol = document.createElement("ol");
  ol.append(...listItems);

  if (ol.children.length > maxItems) {
    const visibleItems = Array.from(ol.children).slice(0, maxItems);
    const hiddenItems = Array.from(ol.children).slice(maxItems);

    ol.innerHTML = "";
    ol.append(...visibleItems);

    const more = document.createElement("li");
    more.innerHTML = `... and <b>${hiddenItems.length}</b> more`;
    more.style.cursor = "pointer";
    more.classList.add("more");

    ol.append(more);
  }

  return ol.outerHTML;
}

/**
 * Handles the click event of the "More" button shown when the number of items
 * in a popup exceeds the maximum number of items specified.
 * @param layer - The layer containing the popup.
 * @param content - An array of strings representing the content to be added to the popup.
 */
function handlePopUpMoreBtn(layer, content: string[]) : void {
  const popUp = layer.getPopup();
  const moreButton = popUp._contentNode.querySelector(".more");

  if (moreButton) {
    moreButton.addEventListener("click", function(e) {
      // we need to stop propagation to prevent the popup from closing
      // because otherwise, leaflet registers a map click
      // when clicking the popup "More" button,
      // which causes the popup to close
      e.stopPropagation();
      // get lines before the list of plays
      const popUpInitialLines = popUp.getContent().split("<ol>")[0];

      popUp.setContent(popUpInitialLines + createList(content, content.length));
    });
  }
}

/**
 * Adds GeoJSON data to the map.
 * @param map - The Leaflet map object.
 * @param data - The GeoJSON data to be added.
 * @param type - The type of data being added (e.g., "locations" or "settings").
 */
function addGeoJSONData(map, data, type: string) : void {
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
          let popUpContent = "";
          const popUpTitle = type === "locations" ? "Location" : "Setting";

          popUpContent = [
            `<b class="map-popup-title">${popUpTitle}</b>`,
            feature.properties.name
            ? `<b>Place</b>: ${feature.properties.name}` : null,
          ].filter(Boolean).join("<br>");

          const playData = feature.properties.playData;
          let playTexts = [];
          Object.values(playData).forEach((play) => {
            const playNameWithDate = play.playDate ?
            `<i>${play.playName}</i> [${play.playDate}]` :
            play.playName ? `<i>${play.playName}</i>` : null;

            let playText = play.authorNames && play.publisherName
            ? `${playNameWithDate} (written by <b>${play.authorNames}</b>,
            published by <b>${play.publisherName}</b>)`
            : play.authorNames ? `${playNameWithDate}
            (written by <b>${play.authorNames}</b>)`
            : play.publisherName ? `${playNameWithDate}
            (published by <b>${play.publisherName}</b>)`
            : playNameWithDate;

            const settingText = play.settingText || null;
            const settingTime = play.settingTime || null;
            playText += settingText ? ` | ${settingText}` : "";
            playText += settingTime ? ` | ${settingTime}` : "";

            playTexts.push(playText);
          });

          popUpContent += playTexts.length === 1 ?
          `<br><b>Play</b>: ${playTexts[0]}` : playTexts.length > 1 ?
          `<br><b>Plays</b>: ${createList(playTexts)}` : "",

          layer.bindPopup(popUpContent, {
            // set maxHeight for overflow:hidden to work
            maxHeight: 300,
          });

          layer.on("popupopen", function () {
            handlePopUpMoreBtn(layer, playTexts);
          });

          markerCluster.addLayer(layer);
      }
  });

  map.addLayer(markerCluster);
}

/**
 * Enables the map filter buttons and handles the filtering logic based on the selected buttons.
 * @param map - The map object.
 */
function enableMapFilterBtns(map) : void {
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

/**
 * Checks if there is only one type of map filter active.
 * @returns True if there is only one active type, false otherwise.
 */
function isOnlyOneTypeActive() : boolean {
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

  return activeTypes.size === 1;
}

/**
 * Filters the markers on the map based on the specified language and type.
 * @param map - The map object.
 * @param lang - The language to filter by.
 * @param type - The type of markers to filter.
 */
function filterMarkers(map, lang: string, type: string) : void {
  const data = type === "locations" ? extendedLocData : extendedSettingData;

  const filteredData = data.filter((item) => {
    // filter by lang to avoid duplicates
    return mapFilters[item.lang].typeEnabled[type] && item.lang === lang;
  });

  const geoJSONData = convertToGeoJSON(filteredData, type);
  addGeoJSONData(map, geoJSONData, type);
};

/**
 * Resets the filters of the map and displays all markers again.
 * @param map - The map object.
 */
function resetMapFilters(map: any) : void {
  $(".map-filter-btn").removeClass("active");

  // change every value in mapFilters object to false
  for (const lang in mapFilters) {
    for (const type in mapFilters[lang].typeEnabled) {
      mapFilters[lang].typeEnabled[type] = false;
    }
  }

  markerCluster.clearLayers();
  markerCluster.enableClustering();

  addGeoJSONData(map, convertToGeoJSON(extendedLocData, "locations"), "locations");
  addGeoJSONData(map, convertToGeoJSON(extendedSettingData, "settings"), "settings");
}