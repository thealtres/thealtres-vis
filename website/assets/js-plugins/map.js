let ogLocData;
const maxListItems = 8;

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
  iconSize: [42, 53], // [width, height]
  popupAnchor: [0, -50] // [x, y]
}

const markerCluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxZoom: 15,
});

export function setMap(locData, settingData, publisherData) {
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
    ogLocData = filteredLocData;

    // extend data with publisher info
    let [extendedLocData, extendedSettingData] = extendData(publisherData,
      filteredLocData, filteredSettingData);

    let geoJSONLocData = convertToGeoJSON(extendedLocData, "locations");
    let geoJSONSettingData = convertToGeoJSON(extendedSettingData, "settings");
    addGeoJSONData(map, geoJSONLocData, "locations");
    addGeoJSONData(map, geoJSONSettingData, "settings");
}

function filterData(...mapData) {
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
      return {
        ...item,
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
        publishers: dataType === "locations" ? item.publishers : null,
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

function createList(data, maxItems = maxListItems) {
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
    more.textContent = `... and ${hiddenItems.length} more`;
    more.style.cursor = "pointer";
    more.classList.add("more");

    ul.append(more);
  }

  return ul.outerHTML;
}

function handlePopUpList(layer, pubs) {
  const popUp = layer.getPopup();
  const moreButton = popUp._contentNode.querySelector(".more");

  if (moreButton) {
    moreButton.addEventListener("click", function() {
      const ul = popUp._contentNode.querySelector("ul");
      ul.innerHTML = createList(pubs, pubs.length);

      const collapseButton = document.createElement("li");
      collapseButton.textContent = "Collapse";
      collapseButton.style.cursor = "pointer";
      collapseButton.addEventListener("click", function() {
        ul.innerHTML = createList(pubs);
      });

      //ul.appendChild(collapseButton);
    });
  }
}

function addGeoJSONData(map, data, type) {
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
          const pubs = feature.properties.publishers;
          const pubTitle = pubs && pubs.length === 1 ? "Publisher" : "Publishers";

          let popUpContent = "";
          const popUpTitle = type === "locations" ? "Location" : "Setting";

          if (type === "locations") {
            popUpContent = [
              `<b class="map-popup-title">${popUpTitle}</b>`,
              feature.properties.name
              ? `<b>Place</b>: ${feature.properties.name}` : null,
              pubs && pubs.length > 0
              ? `<b>${pubTitle}</b>: ${createList(pubs)}` : null
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

          layer.bindPopup(popUpContent);

          layer.on("popupopen", function () {
            //todo: fix popup closing when clicking on more button
            handlePopUpList(this, pubs);
          });

          markerCluster.addLayer(layer);
      }
  });

  map.addLayer(markerCluster);
}
