# Global Planetary Analog Finder

**NASA Space Apps Challenge 2026 · Team PANEM_U · Local Event: Dnipro, Ukraine**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

An open tool for ranking eligible grid cells (~0.5° × 0.625°) against Mars and Moon profiles. The included build covers four pilot regions. It then shows **why** a place is a good analog,
**where the analogy breaks down**, and surfaces **"hidden gems"**: strong analogs that are far from the
well-known analog sites (Atacama, Dry Valleys, Devon Island, Utah, Iceland…).

## Jezero profile using NASA PDS MEDA

Open web/index.html and choose Mars · Jezero (MEDA). The profile compares NASA POWER Earth climate (2001–2025) with a composite of four early Perseverance sols (40, 42, 43 and 46). The marker identifies the landing site. The observations describe the crater as sampled by the rover.

The equal-weight default score uses the mean and range of 24 local mean solar hourly means from ATS_LOCAL_TEMP1. Each criterion uses exp(−(difference / tolerance)²). The project selected tolerances of 30 °C for the mean and 15 °C for the range. Surface pressure (NASA POWER PS and MEDA BAROCAP1 on sol 46), gravity, geology, terrain and radiation references appear separately from the temperature score.

data/jezero-meda.json contains hourly values, coverage, NASA PDS CSV and XML links, and SHA-256 values. To regenerate, download the listed CSVs and XML labels to one folder with the prefix pds- on each file, then run python 3_build_jezero_profile.py <folder> data/jezero-meda.json. Update the derived targets and observation metadata in config.json before rebuilding web/data.js. The design preview uses synthetic data and displays the regional profiles.

The included NASA POWER test dataset covers 892 land cells in four pilot regions after excluding cells in Russia.

## Comparing three Earth cells

Choose a target, then click **Pick on map** in the sidebar and select up to three places. Each place appears with its score and recommendation in **Compare points**. You can also add places from their cards or enter coordinates. Switching targets keeps the selected cells. Open **Criterion weights** to adjust the model or **Calculation details** to see the underlying values. Coordinate selection uses the nearest eligible grid cell within 150 km and displays the coordinates used.

When the comparison is empty, **Show example** loads the Jezero combined profile and two NASA POWER grid cells in Algeria and Ukraine. The example card shows the Sahara cell’s day–night temperature score. **Formula and NASA sources** shows the calculation and links to NASA POWER and the Perseverance MEDA archive. **Full calculation table** opens the breakdown for both points.

Use **Save to favorites** on a place card or **Save compared points** to save all points in the current comparison. **Favorites** lets you remove saved points or add them to another comparison. The list is stored in the current browser.

The criterion menu filters the displayed rows. Each row shows the NASA POWER value, the target, the partial score and its contribution to the overall weighted score. Set a weight to zero to omit a criterion from the map and total. Leave only one positive weight to rank solely by that criterion.

**Jezero (combined)** uses two local MEDA temperature targets and three model proxies: low precipitation, dry topsoil and reflectivity. The Mars-wide Bond albedo of 0.25 provides a screening proxy for terrestrial surface reflectivity. The model starts with five equal weights. A cell’s missing criterion is excluded from its combined score and the table reports available weight coverage. **Jezero (MEDA)** provides the temperatures-only comparison. Pressure is shown separately as mission context.

The filter that excludes cells in Russia applies to selection and ranking. The test dataset includes 892 land cells.

## Measurement-based Mars targets

| Target | Mean air temperature | Temperature range | Observation period |
|---|---:|---:|---|
| Jezero / Perseverance MEDA | −56.684 °C | 50.837 °C | Composite of sols 40, 42, 43, 46 |
| Gale / Curiosity REMS | −46.059 °C | 60.197 °C | Sol 49 |
| Elysium Planitia / InSight TWINS | −62.503 °C | 84.006 °C | Sols 675–681 |

Jezero and Gale use the range of 24 local-solar-hour means. Elysium uses the mean reported daily high-minus-low range. The figures describe their sampled periods. The markers identify the mission landing sites. Rover temperature measurements describe the terrain sampled along the rover tracks. Source products and calculation details are recorded in `data/jezero-meda.json` and `data/mars-site-temperatures.json`.

## Regional profiles

| Target | Examples on the Moon/Mars | What we look for on Earth |
|---|---|---|
| Mars · Equatorial landing sites | Jezero, Gale | hyper-arid, dry soil, very dry air, big day–night swing, albedo ≈ 0.25 |
| Mars · Mid-latitude ground ice | Arcadia / Utopia Planitia | permafrost cold, frost most of the year, polar-desert dryness, bare ground |
| Moon · South-pole base region | Shackleton rim, Artemis regions | extreme cold, no precipitation, calm air, high rugged terrain, dark surface |
| Moon · Basaltic mare plains | Mare Tranquillitatis | very dark surface (albedo ≈ 0.07), bone-dry, large day–night swing |

## Method

1. **Data.** 25-year (2001–2025) climatology from the **NASA POWER API** for every land cell:
   precipitation, topsoil wetness, relative humidity, mean & minimum temperature, day–night and seasonal
   temperature swing, surface albedo (CERES), wind speed, frost days, and elevation (from surface pressure).
   The minimum air temperature at 2 m uses the annual climatology field (`ANN`) of `T2M_MIN` from NASA POWER.
2. **Percentiles.** Each feature is converted into an **area-weighted percentile across Earth's land**
   (cells near the poles are smaller, so they are weighted by cos(latitude)). This makes features with different
   units comparable and lets us express "as dry as possible on Earth" honestly — no place on Earth is as cold or
   as thin-aired as Mars.
3. **Target profiles.** Each Moon/Mars target is described in the same terms (e.g. precipitation → 0th
   percentile; albedo → 0.25), with a weight per feature and a short planetary justification (see `config.json`).
4. **Similarity.** For each feature, `match = exp(-((p_cell − p_target)/σ)²)` with σ = 0.25; the score is the
   weighted mean of the matches (0 = nothing alike, 1 = perfect match on all measured features).
5. **Validation.** Well-known analog sites were **never used to set the targets**. We check where they rank:
   if the method works, they land in the top few percent of Earth's land (random ≈ top 50%).
6. **Hidden gems.** Highest-scoring cells that are ≥ 300 km from any well-known analog site and ≥ 400 km from each
   other — candidates for new, less-studied analog sites.
7. **Honesty about limits.** Every place card lists where the analogy holds, where it breaks, and what no place on
   Earth can reproduce (gravity, vacuum or thin atmosphere, radiation).
8. **Local case studies.** Three Ukrainian sites show a different kind of analog — mineral and process analogs
   that a climate-based search cannot find: Kryvbas banded iron formation (hematite ↔ Meridiani Planum),
   Boltysh impact crater, Oleshky Sands dune field.

## Run it

```bash
pip install -r requirements.txt
python 1_download_data.py          # downloads NASA POWER tiles (~1–1.5 h because of the API rate limit, resumable)
python 2_build_dataset.py --names  # builds web/data.js, CSV outputs and the validation report
# open web/index.html in a browser
```

Outputs: `web/data.js` (map data), `outputs/earth_features.csv`, `outputs/hidden_gems_<target>.csv`,
`outputs/validation_report.txt`.

## Data & resources

- NASA POWER (Prediction Of Worldwide Energy Resources) climatology API — MERRA-2 reanalysis and CERES SYN1deg: https://power.larc.nasa.gov/
- NASA GIBS (Global Imagery Browse Services) — Blue Marble / VIIRS Earth imagery for the 2D map and 3D globe: https://nasa-gibs.github.io/gibs-api-docs/
- NASA Mars Trek — Viking MDIM 2.1 colour mosaic (realistic 3D Mars): https://trek.nasa.gov/mars/
- NASA Moon Trek — LRO WAC global mosaic (realistic 3D Moon): https://trek.nasa.gov/moon/
- three.js (3D rendering, MIT): https://threejs.org/
- NASA NSSDCA planetary fact sheets (Mars, Moon) for target values: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- OpenStreetMap Nominatim (place names): https://nominatim.org/ — © OpenStreetMap contributors
- Leaflet (map library, BSD-2): https://leafletjs.com/
- global-land-mask (land/ocean mask): https://github.com/toddkarin/global-land-mask

## SI disclosure

The code and documentation of this project were drafted with the help of an SI assistant (Claude, by Anthropic)
and reviewed, run and tested by Team PANEM_U. The SI tool did not generate any images, and no NASA logos or
branding elements are used.
