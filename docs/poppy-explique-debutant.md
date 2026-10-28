# Poppy expliqué à un débutant

Oct 15, 2026 · @ALLEY

## Leçon 1 : le problème, raconté avec des banques

**En une phrase : Poppy permet à plusieurs organisations de trouver ensemble les personnes les plus « importantes » d'un réseau, sans jamais se montrer leurs données.**

### Une petite histoire

Imaginez deux banques : la **Banque Amérique** et la **Banque Europe**.

- La Banque Amérique connaît les virements de ses clients : « Charles a envoyé de l'argent à Xavier ».
- La Banque Europe connaît les virements de ses clients : « Xavier a envoyé de l'argent à Yasmine », « Yasmine a envoyé de l'argent à Anna ».

Si on dessine chaque client comme un point et chaque virement comme une flèche, on obtient un **graphe** (un réseau). Ce graphe est coupé en deux morceaux : un morceau chez chaque banque.

### Ce qu'on veut savoir

Une fraude organisée passe souvent par un compte « central », par où l'argent circule beaucoup. On veut donc donner à chaque client une **note d'importance**. Pour bien calculer cette note, il faut voir **tout** le réseau, les deux morceaux ensemble.

### Le blocage

Les banques n'ont pas le droit de s'envoyer les données de leurs clients. La loi l'interdit (par exemple le RGPD en Europe), et ce sont des concurrentes qui ne se font pas confiance.

> **Le problème que résout Poppy :** calculer la note d'importance de chaque client sur le réseau complet, alors que chaque banque garde ses données secrètes.

On dit qu'on a un **graphe distribué** (partagé entre plusieurs « data centers », DC) et des participants **mutuellement méfiants**. Dans les slides, la Banque Amérique est le « Data center 1 » et la Banque Europe le « Data center 2 ».

Le même problème existe pour un réseau social réparti dans plusieurs pays (repérer qui propage des fausses nouvelles) ou pour des hôpitaux (étudier la propagation d'une maladie).

## Leçon 2 : PageRank, ou comment mesurer la popularité

**La « note d'importance » utilisée par Poppy s'appelle PageRank. L'idée : tu es important si des gens importants pointent vers toi.** C'est l'algorithme inventé par Google pour classer les pages web.

### Exemple dans une classe

Trois élèves : Ali, Binta et Cheikh. Chacun désigne les camarades qu'il admire :

- Ali admire Binta et Cheikh.
- Binta admire Cheikh.
- Cheikh admire Ali.

**Règle du jeu.** Au départ, chacun a 1 point. À chaque tour, chacun **donne tous ses points**, partagés à parts égales entre les personnes qu'il admire.

**Tour 1 :**

| Qui donne | Combien | À qui |
| --- | --- | --- |
| Ali (1 point, 2 admirés) | 0,5 chacun | Binta et Cheikh |
| Binta (1 point, 1 admiré) | 1 | Cheikh |
| Cheikh (1 point, 1 admiré) | 1 | Ali |

Résultat après le tour 1 : Ali = 1, Binta = 0,5, **Cheikh = 1,5**. Cheikh est le plus « populaire » : deux personnes l'admirent.

On répète ce jeu plusieurs fois (10 tours dans l'article). Les points se stabilisent et donnent le classement final.

### Les deux petits détails de la vraie formule

1. **Le partage** : quand tu admires 2 personnes, tu donnes la moitié à chacune. C'est la division par le « degré sortant » (le nombre de flèches qui partent de toi).
2. **Le bonus fixe** : on garde 85 % des points reçus (le nombre d = 0,85) et on ajoute à tout le monde une petite part fixe, la même pour tous. Cela évite que des points restent coincés dans une boucle.

La formule de l'article dit exactement ça :

```
nouvelle note de u  =  bonus fixe  +  0,85 × (somme des parts reçues par u)
```

**Ce qu'il faut retenir pour la suite :** pour calculer PageRank, on a seulement besoin d'**additions** et de **multiplications par des nombres connus** (0,85, 1/2, 1/4…). C'est important, car c'est ce que la technique de la leçon 3 sait bien faire.

## Leçon 3 : calculer sur des données enfermées

**Le chiffrement homomorphe permet de faire des calculs sur des nombres enfermés dans un coffre, sans jamais ouvrir le coffre.** C'est l'outil magique de Poppy.

### L'image du coffre à gants

Pensez aux boîtes vitrées des laboratoires, avec des gants intégrés. On peut manipuler ce qu'il y a dedans, mais on ne peut ni le toucher, ni le sortir. Ici, c'est encore plus fort : la vitre est opaque. On manipule sans voir.

- On met le nombre 3 dans un coffre fermé à clé. On met 4 dans un autre.
- Quelqu'un qui n'a pas la clé peut « additionner les deux coffres ». Il obtient un nouveau coffre.
- Celui qui a la clé ouvre ce coffre et trouve 7. Celui qui a fait le calcul n'a jamais vu ni 3, ni 4, ni 7.

On écrit Enc(3) pour « le nombre 3 enfermé » (Enc = *encrypted*, chiffré). On a donc : Enc(3) + Enc(4) = Enc(7).

### Qui a la clé ?

Dans Poppy, un **tiers de confiance** (un arbitre neutre) fabrique les clés :

- il donne à toutes les banques la clé pour **fermer** les coffres (clé publique) ;
- il garde pour lui seul la clé pour **ouvrir** (clé secrète) ;
- à la toute fin, il ouvre le coffre de chaque banque et lui rend les notes de **ses propres clients**, rien de plus.

Une banque reçoit donc des coffres venant de l'autre banque, calcule avec, et les renvoie, sans jamais pouvoir lire ce qu'il y a dedans.

### CKKS : la version utilisée par Poppy

Il existe plusieurs systèmes de chiffrement homomorphe. Poppy utilise **CKKS**, qui a trois qualités utiles ici :

1. Il travaille avec des nombres à virgule (0,85, 0,333…), ce qu'il faut pour PageRank.
2. Il sait additionner **et** multiplier dans le coffre, et même faire une division approximative. Les méthodes plus anciennes ne savaient qu'additionner.
3. Un coffre peut contenir **beaucoup de nombres à la fois** (leçon 4).

Le prix à payer : c'est **très lent et très lourd**. Un seul coffre pèse environ 39 Mo, et les calculs dans le coffre prennent des millisecondes au lieu de nanosecondes. CKKS ajoute aussi une toute petite erreur aux nombres. C'est pour ça que les résultats de Poppy sont « presque » identiques au calcul normal, mais pas parfaitement.

## Leçon 4 : la boîte à cases et la règle des cases alignées

**Un coffre CKKS n'est pas une petite boîte pour un seul nombre : c'est une longue boîte à cases, comme une boîte à œufs, avec jusqu'à 65 536 cases.** Tout Poppy repose sur la bonne façon de remplir ces cases.

### Avantage : une opération agit sur toutes les cases à la fois

Si on additionne deux boîtes, chaque case s'additionne avec la case **au même endroit** dans l'autre boîte, en une seule opération :

```
boîte 1 :   [  1 |  2 |  3 |  4 ]
boîte 2 :   [ 10 | 20 | 30 | 40 ]
somme   :   [ 11 | 22 | 33 | 44 ]     <- une seule addition pour 4 calculs
```

C'est comme un professeur qui corrige 30 copies d'un seul coup de tampon. On appelle ça le **SIMD** (une instruction, plusieurs données). Avec 65 536 cases, on fait 65 536 calculs pour le prix d'un.

### La règle stricte : on ne mélange jamais deux cases d'une même boîte

On ne peut **pas** dire « ajoute la case 1 à la case 3 ». On ne peut additionner que des cases qui sont **à la même position** dans deux boîtes différentes.

Alors comment faire si un nombre n'est pas à la bonne place ? Deux outils :

**1. La rotation : faire tourner la boîte.** Imaginez un tapis roulant de restaurant de sushis : on peut faire avancer tout le tapis d'un cran, mais pas déplacer une seule assiette.

```
avant  :   [ a | b | c | d ]
après une rotation d'un cran vers la droite :
           [ d | a | b | c ]
```

**2. Le masque : un pochoir.** On multiplie la boîte par une suite de 0 et de 1. Les cases multipliées par 0 deviennent vides, celles multipliées par 1 restent.

```
[ d | a | b | c ]  ×  [ 0 | 1 | 0 | 0 ]  =  [ 0 | a | 0 | 0 ]
```

En combinant les deux, on peut déplacer « a » de la case 1 vers la case 2, tout seul.

### Le point le plus important de tout le cours

La rotation est **l'opération la plus chère** : environ 100 fois plus lente qu'une multiplication par un nombre connu. Donc :

> **Toute l'intelligence de Poppy consiste à bien ranger les nombres dans les cases, pour faire le moins de rotations possible.**

Si vous retenez cette phrase, vous avez compris l'essentiel de l'article.

## Leçon 5 : la méthode naïve (baseline), slides 17 et 18

**La méthode naïve donne une boîte entière à chaque client, pour y mettre un seul nombre. Ça marche, mais c'est un énorme gaspillage.**

### Le réseau des slides

La slide 17 montre deux nuages :

- **Data center 1** (Amérique) avec les clients A, B, C, D, E, F ;
- **Data center 2** (Europe) avec les clients x, y, m, n.

Les flèches vertes en pointillés traversent l'océan : C → x, et y → A, y → B. Ce sont les virements entre les deux banques.

### Comment calcule la méthode naïve

Chaque client a sa propre boîte. Seule la première case est remplie ; toutes les autres valent 0. Pour calculer la note de D, qui reçoit des flèches de C, E et F (slide 18) :

```
[ note(D) | 0 | 0 | 0 ]  =  [ bonus | 0 | 0 | 0 ]
                          + 0,85 × ( [ part de C | 0 | 0 | 0 ]
                                   + [ part de E | 0 | 0 | 0 ]
                                   + [ part de F | 0 | 0 | 0 ] )
```

Le cadre rouge de la slide 18 entoure la seule ligne utile. Tout le reste de chaque boîte est vide.

### Pourquoi c'est un gaspillage

C'est comme envoyer un camion de 65 536 places pour transporter **un seul œuf**, puis un autre camion pour l'œuf suivant.

- **Trop de boîtes** : une par client. Une banque de 10 000 clients manipule 10 000 boîtes.
- **Trop de mémoire** : une boîte pèse environ 39 Mo. 20 000 clients × 39 Mo ≈ 780 Go. Dans l'article, la méthode naïve plante justement à partir de 20 000 nœuds, sur une machine qui a pourtant 512 Go de mémoire.
- **Trop de calculs inutiles** : on additionne des milliers de zéros enfermés.
- **Trop d'envois** : il faut envoyer une boîte entière pour chaque client situé à la frontière entre les banques.

Cette méthode sert de point de comparaison (« baseline ») : Poppy doit faire mieux qu'elle.

## Leçon 6 : la méthode PoppyS (Poppy\_uj), slide 19, pas à pas

**PoppyS met les notes de tous les clients d'une banque dans une seule boîte, une case par client. Ensuite, il prépare quelques « plateaux » où chaque part reçue est déjà rangée sous la bonne case. Il ne reste alors qu'à tout additionner d'un coup.**

On suit la Banque Europe (Data center 2) avec ses 4 clients x, y, m, n.

### Étape 1 : une seule boîte pour toute la banque

```
notes = [ note(x) | note(y) | note(m) | note(n) ]
```

Au lieu de 4 boîtes presque vides (méthode naïve), une seule boîte bien remplie.

### Étape 2 : qui reçoit quoi ?

On regarde les flèches qui arrivent sur chaque client :

- x reçoit de **C** (client de l'autre banque ; C partage entre 3 personnes, donc C/3)
- y reçoit de x (x partage entre 2 personnes, donc x/2)
- m reçoit de x, de y et de n (donc x/2, y/4 et n/1)
- n reçoit de y (y partage entre 4 personnes, donc y/4)

m reçoit 3 parts, c'est le maximum. Il faudra donc **3 plateaux**.

### Étape 3 : ranger les parts sur des plateaux

Chaque plateau est une boîte de la même taille, où chaque part est rangée **exactement sous la case du client qui la reçoit**. Le plateau 1 contient la 1re part reçue par chacun, le plateau 2 la 2e, le plateau 3 la 3e. Ce sont les vecteurs u₁, u₂, u₃ de la slide 19 (d'où le nom « Poppy\_uj »).

```
cases :        x        y        m        n
plateau 1 : [ C/3   |  x/2   |  x/2   |  y/4 ]
plateau 2 : [ 0     |  0     |  y/4   |  0   ]
plateau 3 : [ 0     |  0     |  n     |  0   ]
```

### Étape 4 : tout additionner d'un seul coup

```
nouvelles notes = bonus + 0,85 × (plateau 1 + plateau 2 + plateau 3)
```

Trois additions, et les 4 clients sont mis à jour en même temps. Avec 10 000 clients, ce serait toujours aussi peu d'additions, car le nombre de plateaux dépend du client qui reçoit le plus de flèches, pas du nombre de clients.

### Comment on remplit un plateau (c'est là qu'on paie)

**Avec ses propres clients.** La Banque Europe veut mettre x/2 sous la case de y. Elle prend sa boîte de notes, la fait tourner d'un cran, puis applique un pochoir :

```
boîte de notes :         [ x | y | m | n ]
rotation d'un cran :     [ n | x | y | m ]
pochoir [0|1|0|0] :      [ 0 | x | 0 | 0 ]
× 1/2 :                  [ 0 | x/2 | 0 | 0 ]   <- prêt pour le plateau 1
```

Elle fait pareil pour chaque part. Chaque flèche coûte donc environ une rotation.

**Avec les clients de l'autre banque.** La part de C appartient à la Banque Amérique. C'est **elle** qui fait tourner sa boîte et applique le pochoir pour que C/3 tombe pile dans la case de x, puis elle envoie la boîte fermée : \[ C/3 | 0 | 0 | 0 \]. La Banque Europe l'ajoute à son plateau sans pouvoir l'ouvrir. Elle ne sait même pas combien vaut C. Dans l'autre sens, la Banque Europe prépare y/4 rangé sous les cases de A et de B et l'envoie à la Banque Amérique.

### Le déroulé complet (vocabulaire des slides)

1. **Pré-traitement** : on retire du calcul les clients inutiles (leçon 7) et on prépare les premiers plateaux.
2. **Calcul, répété 10 fois** : recevoir les plateaux des autres banques (*synchronisation*), tout additionner (*mise à jour*), préparer les plateaux du tour suivant (*préparation*).
3. **Complétion** : l'arbitre ouvre la boîte finale de la banque, et la banque recopie les notes des clients qu'on avait mis de côté.

### Bilan

|  | Méthode naïve | PoppyS |
| --- | --- | --- |
| Boîtes de notes pour la Banque Europe | 4 (une par client) | 1 |
| Boîtes pour 10 000 clients | 10 000 | 1 |
| Ce qui coûte cher | le nombre de clients | le nombre de flèches (une rotation par flèche) |

PoppyS est donc excellent quand il y a **peu de flèches** par client (un graphe « creux »). Quand chacun est relié à beaucoup de monde, les rotations s'accumulent : c'est son point faible.

## Leçon 7 : le reste en deux mots, résumé et questions simples

**Poppy propose deux autres variantes pour les réseaux très connectés, et une astuce pour retirer du calcul les clients inutiles.**

### PoppyD (PoppyM) et PoppyH (PoppyM2)

- **PoppyD** range « qui donne à qui » dans un grand tableau (une matrice) et utilise une recette connue pour multiplier ce tableau par la boîte de notes. Le nombre de rotations dépend du **nombre de clients**, plus du nombre de flèches. Il gagne donc quand il y a beaucoup de flèches.
- **PoppyH** est un mélange : le tableau pour les clients de la banque, et des plateaux comme PoppyS pour les parts venant des autres banques. Il gagne quand il y a beaucoup de clients étrangers.

### Retirer les clients inutiles (l'élagage)

Moins de clients = moins de rotations. Trois sortes de clients peuvent sortir du calcul sans changer aucune note :

- **Celui que personne n'admire** : sa note ne change jamais (c'est juste le bonus). On l'écrit à la fin.
- **Celui qui n'admire personne** : il ne donne rien à personne, donc il n'influence aucune autre note. On le calcule seulement au dernier tour (c'est le cas de m).
- **Les « jumeaux »** : deux clients qui reçoivent exactement les mêmes parts des mêmes personnes ont toujours la même note. On en calcule un, et on recopie sa note à l'autre. Par exemple, si Sam envoie de l'argent à Lina et à Paul, et que personne d'autre ne leur en envoie, Lina et Paul ont la même note. L'article appelle ça l'**INC-équivalence**, et l'algorithme qui trouve les jumeaux s'appelle **PINC**.

Sur un graphe réel de l'article, cet élagage rend le calcul jusqu'à 1,85 fois plus rapide.

### Ce que ça donne en vrai

- Les notes obtenues sont quasiment identiques à celles du calcul normal, et le top 10 des clients les plus importants est presque toujours exactement le même.
- Mais c'est lent : sur un réseau de 10 876 clients réparti dans 5 banques, un seul tour de PoppyS prend 11,5 heures au début, puis environ 1,7 heure.
- Plus il y a de banques, plus chacune a peu de clients, donc plus c'est rapide pour chacune (2 fois plus rapide en passant de 5 à 10 banques).

### Le résumé à retenir

1. **Le problème** : plusieurs organisations veulent trouver les nœuds importants d'un réseau qu'elles se partagent, sans se montrer leurs données.
2. **L'outil** : le chiffrement homomorphe CKKS, qui permet de calculer dans des coffres fermés.
3. **La difficulté** : les calculs dans les coffres sont très lents, surtout les rotations.
4. **La méthode naïve** : un coffre par client, presque vide, donc un gaspillage énorme.
5. **L'idée de PoppyS** : un seul coffre par banque, et des plateaux bien rangés pour tout additionner d'un coup.

### Questions simples à poser à votre encadreur

1. Quelle partie du projet vais-je toucher en premier : une variante de Poppy, l'élagage, ou une visualisation ?
2. Pouvez-vous me montrer au tableau comment on construit les plateaux u₁, u₂, u₃ de la slide 19 ?
3. Pourquoi une rotation coûte-t-elle si cher comparée à une addition ?
4. Qui joue le rôle de l'arbitre qui a la clé secrète dans la vraie vie, et peut-on s'en passer ?
5. Qu'apprend une banque sur l'autre, malgré le chiffrement ? (L'article admet par exemple que les flèches entre banques sont connues.)
6. Comment savoir à l'avance quelle variante choisir, PoppyS, PoppyD ou PoppyH ?
7. Puis-je lancer le code sur un petit exemple pour voir les notes sortir, et sur quelle machine ?

Le premier document, plus technique, reste disponible avec 20 questions plus poussées pour plus tard.
