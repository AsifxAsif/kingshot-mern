============================================
WHERE TO PUT IMAGES (CRITICAL)
============================================

CORRECT path (Vite serves "public" at site root):

  kingshot-mern/client/public/assets/

NOT these (images will NOT load):
  client/src/assets/
  client/assets/
  assets/   (at project root)
  server/assets/

Full example structure (same as your original site):

  client/public/assets/
    Bread.webp
    Wood.webp
    Stone.webp
    Iron.webp
    Gold.webp
    building_speedup.webp
    training_speedup.webp
    research_speedup.webp
    vault_icon.webp
    Infantry.webp
    Cavalry.webp
    Archer.webp
    building/
      town_center.webp
      barracks.webp
      ...
    heroes/
      edwin.webp
      amadeus.webp
      ...
    widget/
      amadeus_widget.webp
      ...
    pet/
      grey_wolf.webp
      ...
    war_academy/
      ...
    gov_gears/
    gov_charms/
    hero_gear/

Copy command (from your old site folder):

  cp -R /path/to/old-site/assets/*  kingshot-mern/client/public/assets/

Then restart the Vite dev server (npm run dev).

Browser URL test: http://localhost:3000/assets/Bread.webp
If that 404s, the folder is wrong.
