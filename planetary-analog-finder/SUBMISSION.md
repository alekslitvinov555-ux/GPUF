# Project submission texts — Team PANEM_U

Copy each block into the matching field of the Project tab on spaceappschallenge.org.
Replace every `[…]` with the real numbers from `outputs/validation_report.txt` and `outputs/hidden_gems_*.csv`.

---

## Project Name
```
Global Planetary Analog Finder
```

## Summary  (field limit 1500 characters; ~170 words here)
```
Global Planetary Analog Finder is an interactive web map that searches all of Earth's land for places that resemble four targets on the Moon and Mars: equatorial Mars landing sites (Jezero, Gale), Martian mid-latitude ground ice, the lunar south-pole base region, and the Moon's dark basaltic mare plains.

Using 25 years of NASA POWER climatology (MERRA-2 and CERES), we describe every land cell by 11 environmental features (dryness, soil wetness, humidity, temperature extremes, day-night and seasonal swings, albedo, wind, frost days, elevation), convert them into area-weighted percentiles, and score each cell against each target profile.

The method is validated on well-known analog sites that were never used to set the targets: they rank in the top [X]% of Earth's land. It then proposes "hidden gems": strong analogs located far from the classic sites, such as [gem 1] and [gem 2]. Every place card explains where the analogy holds, where it breaks down, and what Earth can never reproduce (gravity, vacuum, radiation). This helps mission teams find new, less-studied places to test rovers, instruments and operations before flying.
```

## Project Demonstration
Link to the 30-second video (YouTube, public or unlisted) **or** a 7-slide deck (Google Slides with "Anyone with the link can view").

## Project
Link to the GitHub repository or the GitHub Pages map, e.g. `https://<login>.github.io/planetary-analog-finder/web/`

## Project Details
```
WHAT IT DOES
Global Planetary Analog Finder ranks every land cell on Earth (~0.5° x 0.625°, about [N] cells) by its similarity to four Moon and Mars targets, and shows the result as an interactive similarity map. Clicking any place opens a card with its similarity score, its rank among all of Earth's land, a feature-by-feature comparison, where the analogy holds, where it breaks down, and the conditions no place on Earth can reproduce.

HOW IT WORKS
1. Data: we download the 2001-2025 climatology of 10 parameters from the NASA POWER API for the whole globe (648 tiles x 10 parameters): precipitation, topsoil wetness, relative humidity, mean and minimum temperature, day-night temperature range, surface albedo (CERES SYN1deg), wind speed, frost days and surface pressure, which we convert to elevation. Seasonal swing is computed from the monthly temperatures.
2. Comparable units: no place on Earth is as cold or as thin-aired as Mars, so instead of raw values we use area-weighted percentiles across Earth's land (cells are weighted by cos(latitude) because polar grid cells are smaller). A target is described as "the driest end of Earth's range", "albedo 0.25", etc.
3. Target profiles: each target has weights and a written planetary justification (e.g. Mars global albedo ~0.25; lunar mare albedo ~0.07; no wind or precipitation on the airless Moon).
4. Similarity: for each feature, match = exp(-((p_cell - p_target)/0.25)^2); the score is the weighted mean.
5. Validation: well-known analog sites (Atacama, McMurdo Dry Valleys, Devon Island, Death Valley, Utah MDRS, Pilbara, Ladakh, Qaidam, Lanzarote, Hawaii and others) were not used to tune the method. They rank in the top [X]% of Earth's land for their target (a random method would put them near the top 50%).
6. Hidden gems: the best-scoring cells that are at least 300 km from any well-known analog site and 400 km from each other. Our top candidates: [list 3-5 gems with target and score].
7. Users can change the weight of each feature with sliders; the map, validation and hidden gems are recomputed live in the browser.

LOCAL CASE STUDIES (UKRAINE)
A climate search cannot find mineral or process analogs, so we added three curated Ukrainian sites and show honestly that their climate does not match: the Kryvyi Rih banded iron formation with hematite quartzites (banded iron formations are proposed analogs for the hematite at Meridiani Planum explored by Opportunity), the buried 24-km Boltysh impact crater with a preserved melt sheet and crater-lake sediments, and the Oleshky Sands dune field.

BENEFITS AND IMPACT
- Gives mission planners, scientists and educators a transparent, reproducible way to search the whole planet for new test sites instead of reusing the same few famous ones.
- Explains WHY a site is (or is not) a good analog, which reduces the risk of testing in a place that only looks similar.
- Open data and open code: anyone can add a new target profile in config.json.

TOOLS
Python (pandas, numpy, global-land-mask), NASA POWER REST API, JavaScript with Leaflet (2D map) and three.js (3D globe), NASA GIBS Blue Marble Earth imagery, NASA Mars Trek (Viking colour mosaic) and Moon Trek (LRO WAC) imagery for realistic 3D views of the target bodies, OpenStreetMap Nominatim for place names.

CREATIVITY AND FACTORS CONSIDERED
We compare places by percentiles rather than raw numbers, weight cells by area, validate against known analogs that were held out, force novelty with a distance filter, and always state the limits of each analogy (gravity, pressure, radiation, perchlorates, vacuum). Limitations: 0.5-degree resolution, climate-only features (no mineralogy or roughness yet); next steps are adding NASA SRTM roughness and ASTER mineralogy layers.

SI DISCLOSURE
Parts of the code and of this text were drafted with an SI assistant (Claude, by Anthropic) and were reviewed, run and tested by our team. No images were generated with SI. The SI disclosure is also written in the code headers and HTML metadata.
```

## Use of Super Intelligence (SI)
Select the options for **code** and **text/writing** (whatever names the form uses for them).
Do **not** select images, video or audio unless you actually generate them with SI.
If you make the video with SI-generated voice or images, add a visible "SI-generated" watermark, as the form requires.

## NASA Data (Link Text → Link Url)
| Link Text | Link Url |
|---|---|
| NASA POWER Climatology API (MERRA-2, CERES SYN1deg) | https://power.larc.nasa.gov/ |
| NASA GIBS – Blue Marble & VIIRS Earth imagery | https://nasa-gibs.github.io/gibs-api-docs/ |
| NASA Mars Trek – Viking MDIM 2.1 colour mosaic | https://trek.nasa.gov/mars/ |
| NASA Moon Trek – LRO WAC global mosaic | https://trek.nasa.gov/moon/ |
| NASA NSSDCA Mars Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| NASA NSSDCA Moon Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html |

## Space Agency Partner & Other Data
| Link Text | Link Url |
|---|---|
| OpenStreetMap Nominatim (place names, © OpenStreetMap contributors) | https://nominatim.org/ |
| Leaflet map library (BSD-2) | https://leafletjs.com/ |
| three.js 3D library (MIT) | https://threejs.org/ |
| global-land-mask Python package | https://github.com/toddkarin/global-land-mask |
| Boltysh crater (facts) | https://en.wikipedia.org/wiki/Boltysh_crater |
| Allen et al. 2001, Importance of a Martian Hematite Site for Astrobiology (BIF analogs) | https://doi.org/10.1089/153110701750137495 |
| Claude by Anthropic (SI assistant used for code drafting) | https://www.anthropic.com/claude |

---

# 30-second video script (screen recording of the map + voice or text captions)

Speak Ukrainian or English; if Ukrainian, **add English subtitles** (required).

| Time | On screen | Caption / voice (English) |
|---|---|---|
| 0:00–0:04 | Title card: project name + team names + challenge name | "Team PANEM_U, Dnipro. Challenge: Earth analogs for the Moon and Mars." |
| 0:04–0:10 | Whole-Earth heatmap for "Mars · Equatorial landing sites" | "We scored every land cell on Earth against Mars and Moon targets using 25 years of NASA POWER data." |
| 0:10–0:15 | Validation box, pan to Atacama | "Known analogs like Atacama rank in the top [X]%, so the method works." |
| 0:15–0:22 | Click a hidden gem, card opens | "Then it finds hidden gems, like [gem], and explains where the analogy holds and where it breaks." |
| 0:22–0:27 | Switch to "Moon · South-pole", move a slider | "Switch targets, tune the weights, and the whole map updates live." |
| 0:27–0:30 | Map + repo link | "Open data, open code: Global Planetary Analog Finder." |

Recording tip: Windows `Win + Alt + R` (Xbox Game Bar) records the browser window; cut to 30 s in Clipchamp, add subtitles there.

# Alternative: 7-slide deck (max 7 slides including the title)

1. **Title.** Global Planetary Analog Finder · team PANEM_U, member names · challenge name · Dnipro.
2. **Problem.** Analog research reuses a few famous sites; there is no systematic global search that explains *why* a place is analogous.
3. **Data.** NASA POWER 2001–2025 climatology (MERRA-2, CERES): 11 features for every land cell.
4. **Method.** Area-weighted percentiles → target profiles → Gaussian match → weighted score (one simple diagram).
5. **Validation.** Known analogs rank in the top [X]% (bar chart or table).
6. **Discoveries.** Map with hidden gems + one place card (holds / breaks) + Ukrainian case studies.
7. **Impact & next steps.** New test sites for missions, education; next: SRTM roughness, ASTER mineralogy, higher resolution. Links to the map and repo.
