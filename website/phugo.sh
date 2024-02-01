hugo



rsync -avh public/ site/ --delete

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/index.html

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/events/data-and-theater/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/evenements/donnees-de-theatre/index.html

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/events/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/evenements/index.html

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/post/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/post/index.html

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/post/23-10-15-fete-de-la-science/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/post/23-10-15-fete-de-la-science/index.html

sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/post/2023-06-28-poster-humanistica/index.html
sed -i.bkp 's/class="fas fa-globe mr-1"/class="fa fa-language"/g' site/fr/post/2023-06-28-poster-humanistica/index.html
