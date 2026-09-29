# Direzione visiva di Punto

## Identità e funzione

Avorio, verde bosco e lime. Tipografia editoriale nella presentazione, interfaccia compatta nel workspace. Il 3D accompagna il software senza entrare nei flussi operativi: richieste, commesse, attività e approvazioni rimangono leggibili e rapide da usare.

La scultura astratta rappresenta elementi distinti che trovano una direzione comune. Le quattro composizioni della scena seguono richiesta, progetto, revisione e consegna. I contenuti della scheda nella scena sono esempi illustrativi; i dati operativi sono nel gestionale PHP.

## Scena interattiva

Geometrie originali costruite con Three.js, materiali fisici e luci da studio. La scena risponde al cursore e alle quattro fasi, selezionabili anche da tastiera. GSAP coordina gli ingressi e il mockup del workspace; lo scorrimento resta nativo.

La preferenza di movimento ridotto e il comando manuale sospendono le animazioni. Il rendering viene fermato fuori vista e a scheda nascosta, il rapporto di pixel è limitato a 1,5. Senza WebGL rimane una composizione CSS.

## Film in loop

La clip è generata con Kling a partire da una cattura del modello originale importato in Spline. Non è un export video nativo Spline né una riproduzione geometrica esatta del modello: contiene anche un secondo anello introdotto dalla generazione.

L’export ufficiale senza watermark è stato montato in avanti e al contrario, senza duplicare i fotogrammi alle estremità: 240 fotogrammi, 24 fps, ciclo di 10 secondi. H.264, senza audio, Full HD su desktop e 960 × 540 su mobile. I file finali sono serviti localmente da `public/assets/films/`, con poster JPEG e caricamento differito.

Il film parte quando visibile e continua in loop. Rimangono disponibili pausa e ripresa da tastiera; viene sospeso fuori vista, a scheda nascosta e con la pausa globale. Movimento ridotto e risparmio dati impediscono l’avvio automatico. Nessun nome o marchio degli strumenti compare nell’interfaccia.

## Anteprime del software

Il mockup del workspace è HTML/CSS originale con due schermate reali della demo: panoramica e commessa. Le schede sono utilizzabili con tastiera; l’ingrandimento usa un dialogo nativo con ritorno del focus. Le immagini contengono dati dimostrativi.

Le prove di export Rotato con watermark e gli editor esterni non fanno parte della release. Non sono necessari abbonamenti a questi strumenti per avviare il codice pubblicato. I materiali di lavorazione rimangono locali ed esclusi dal repository.

## Verifiche

Controllati riproduzione effettiva, ritorno automatico all’inizio del loop, pausa/ripresa da tastiera, arresto fuori vista, pausa globale, cambio delle anteprime e ingrandimento. La variante mobile è stata verificata nel browser a 390 px, senza overflow orizzontale. Le preferenze di movimento ridotto e risparmio dati sono gestite dal codice; non sono state emulate nel collaudo del film.

Le schermate di presentazione sono acquisite dal sito locale funzionante. Per il backend, i risultati e i limiti del collaudo sono in [TEST.md](TEST.md).
