/* Alimentos básicos que vienen de serie en la biblioteca de alimentos.
 * Selección de alimentos para una dieta sana (sin alcohol ni ultraprocesados).
 * Valores medios de referencia por 100 g de parte comestible (100 ml en bebidas), en crudo
 * salvo que se indique. Fuente: tablas de composición BEDCA (España) y USDA, contrastadas
 * con el etiquetado habitual de marca blanca en supermercados españoles. Hidratos sin fibra,
 * como en las etiquetas europeas. Son medias orientativas: cada marca puede variar un poco.
 * Cada alimento: { id, name, category, portion, kcal, protein, carbs, fat, notes }. */
(function () {
  'use strict';

  const list = [];
  const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /** Añade los alimentos de una categoría: [nombre, kcal, proteínas, hidratos, grasas, cantidad, notas]. */
  function cat(category, rows) {
    for (const [name, kcal, protein, carbs, fat, portion, notes] of rows) {
      list.push({ id: `food-${slug(name)}`, name, category, portion: portion || '100 g', kcal, protein, carbs, fat, notes: notes || '' });
    }
  }

  cat('Carnes y aves', [
    ['Pechuga de pollo (cruda)', 110, 23, 0, 1.6],
    ['Muslo de pollo sin piel (crudo)', 120, 19.5, 0, 4.5],
    ['Pollo entero con piel (crudo)', 215, 18, 0, 15.5],
    ['Pechuga de pavo (cruda)', 105, 23.5, 0, 1.2],
    ['Solomillo de cerdo (crudo)', 120, 21, 0, 3.5],
    ['Lomo de cerdo (crudo)', 140, 21, 0, 6],
    ['Ternera magra (cruda)', 120, 21.5, 0, 3.5],
    ['Carne picada de vacuno (cruda)', 210, 18, 0, 15, '', 'Picada estándar (~15 % grasa). La versión extra magra ronda 130 kcal.'],
    ['Hamburguesa de vacuno (cruda)', 220, 16, 3, 16],
    ['Hamburguesa de pollo (cruda)', 165, 16, 4, 9.5],
    ['Conejo (crudo)', 135, 21, 0, 5.5],
    ['Cordero pierna (crudo)', 200, 18, 0, 14],
    ['Pechuga de pollo a la plancha', 165, 31, 0, 3.6, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Muslo de pollo sin piel asado', 180, 25, 0, 8, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Pechuga de pavo a la plancha', 135, 30, 0, 1.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Solomillo de cerdo a la plancha', 145, 26, 0, 3.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Lomo de cerdo a la plancha', 195, 28, 0, 9, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Ternera magra a la plancha', 165, 29, 0, 5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Carne picada de vacuno cocinada', 250, 26, 0, 15.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Hamburguesa de vacuno a la plancha', 260, 22, 3.5, 17.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Hamburguesa de pollo a la plancha', 200, 20, 5, 11, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Conejo cocinado', 180, 29, 0, 7, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Cordero pierna asado', 255, 25.5, 0, 16.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
  ]);

  cat('Embutidos y fiambres', [
    ['Fiambre de pechuga de pavo', 100, 19, 1.5, 1.5, '', 'Lonchas tipo «90 % pechuga».'],
    ['Fiambre de pechuga de pollo', 100, 18.5, 2, 1.8],
    ['Jamón cocido extra', 110, 19, 1, 3.5],
    ['Jamón serrano', 240, 31, 0.5, 13],
    ['Jamón ibérico', 330, 30, 0.5, 23],
    ['Lomo embuchado', 220, 38, 1, 7],
  ]);

  cat('Pescados y mariscos', [
    ['Salmón fresco (crudo)', 200, 20, 0, 13],
    ['Salmón ahumado', 180, 22, 0, 10],
    ['Merluza (cruda)', 80, 17.5, 0, 1],
    ['Bacalao fresco (crudo)', 80, 18, 0, 0.7],
    ['Bacalao desalado (crudo)', 85, 19, 0, 0.6],
    ['Lubina (cruda)', 100, 19, 0, 2.5],
    ['Dorada (cruda)', 120, 20, 0, 4.5],
    ['Atún fresco (crudo)', 130, 23, 0, 4.5],
    ['Emperador / pez espada (crudo)', 120, 20, 0, 4.5],
    ['Sardinas frescas (crudas)', 140, 20, 0, 6.5],
    ['Boquerones frescos (crudos)', 115, 20, 0, 4],
    ['Atún al natural (lata, escurrido)', 105, 24, 0, 1],
    ['Atún en aceite de oliva (lata, escurrido)', 190, 26, 0, 9.5],
    ['Sardinas en aceite (lata, escurridas)', 210, 24, 0, 13],
    ['Caballa en aceite (lata, escurrida)', 230, 20, 0, 17],
    ['Langostinos / gambas cocidos', 95, 21, 0, 1.2],
    ['Gambas peladas congeladas (crudas)', 80, 18, 0, 1],
    ['Mejillones (crudos)', 75, 12, 3, 2],
    ['Calamar (crudo)', 90, 16, 3, 1.4],
    ['Sepia (cruda)', 80, 16, 1, 1],
    ['Pulpo (crudo)', 80, 15, 2, 1],
    ['Palitos de surimi', 95, 7, 14, 1],
    ['Salmón a la plancha / al horno', 210, 22, 0, 13, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Merluza a la plancha / al horno', 100, 21.5, 0, 1.3, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Bacalao fresco cocinado', 105, 23, 0, 0.9, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Lubina al horno', 125, 24, 0, 2.6, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Dorada al horno', 150, 25, 0, 5.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Atún fresco a la plancha', 165, 29, 0, 5.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Emperador a la plancha', 150, 25, 0, 5.5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Sardinas a la plancha', 175, 25, 0, 8, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Boquerones a la plancha', 145, 25, 0, 5, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Gambas a la plancha', 100, 22, 0, 1.3, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Mejillones cocidos', 170, 24, 7, 4.5, '', 'Peso sin concha.'],
    ['Calamar a la plancha', 115, 21, 4, 1.8, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Sepia a la plancha', 155, 32, 1.6, 1.4, '', 'Cocinado sin aceite añadido. Al cocinar pierde ≈ 25 % de agua: 100 g en crudo ≈ 75 g cocinados.'],
    ['Pulpo cocido', 165, 30, 4.4, 2, '', 'Al cocerlo pierde mucha agua: 100 g en crudo ≈ 50–60 g cocido.'],
  ]);

  cat('Huevos', [
    ['Huevo entero', 145, 12.5, 0.7, 10, '', 'Un huevo talla L sin cáscara pesa unos 60 g (≈ 87 kcal).'],
    ['Clara de huevo', 48, 10.5, 0.7, 0.2, '', 'También vale para las claras pasteurizadas en brik.'],
    ['Yema de huevo', 320, 16, 0.5, 28],
  ]);

  cat('Proteína vegetal', [
    ['Tofu firme', 135, 14, 1, 8],
    ['Seitán', 125, 23, 5, 1.5],
    ['Tempeh', 190, 19, 7, 11],
    ['Soja texturizada (seca)', 335, 50, 17, 1.5],
  ]);

  cat('Lácteos', [
    ['Leche entera', 64, 3.1, 4.7, 3.6, '100 ml'],
    ['Leche semidesnatada', 46, 3.2, 4.7, 1.6, '100 ml'],
    ['Leche desnatada', 34, 3.3, 4.8, 0.2, '100 ml'],
    ['Leche sin lactosa semidesnatada', 45, 3.2, 4.7, 1.5, '100 ml'],
    ['Bebida de soja sin azúcar', 32, 3.2, 0.4, 1.8, '100 ml'],
    ['Bebida de avena', 45, 0.5, 7, 1.4, '100 ml'],
    ['Bebida de almendra sin azúcar', 15, 0.5, 0.3, 1.2, '100 ml'],
    ['Yogur natural', 60, 3.5, 4.7, 3],
    ['Yogur natural desnatado', 42, 4.5, 5.5, 0.1],
    ['Yogur griego natural', 125, 3.4, 4.5, 10],
    ['Yogur proteico natural', 55, 10, 3.7, 0.2, '', 'Tipo «+Proteínas» / alto en proteínas.'],
    ['Skyr natural', 63, 11, 4, 0.2],
    ['Kéfir natural', 60, 3.5, 4, 3.3],
    ['Queso fresco batido 0 %', 46, 8, 3.5, 0.2],
    ['Queso fresco tipo Burgos', 175, 12, 3, 13],
    ['Queso fresco tipo Burgos light', 105, 13, 3.5, 4.5],
    ['Queso cottage', 98, 11, 3.4, 4.3],
    ['Requesón', 100, 11, 3.5, 4.5],
    ['Mozzarella fresca', 245, 18, 1, 19],
    ['Queso semicurado', 370, 24, 0.5, 30],
    ['Queso curado', 400, 26, 0.5, 33],
    ['Queso en lonchas (tipo gouda)', 350, 24, 0.5, 28],
    ['Queso en lonchas light', 250, 30, 0.5, 14],
    ['Queso rallado', 390, 28, 1, 31],
    ['Queso de cabra (rulo)', 300, 19, 1, 25],
    ['Queso para untar', 240, 6, 4, 22],
    ['Nata para cocinar (18 %)', 190, 2.5, 4, 18, '100 ml'],
  ]);

  cat('Cereales, pan y pasta', [
    ['Arroz blanco (crudo)', 355, 7, 78, 0.6],
    ['Arroz blanco cocido', 130, 2.7, 28, 0.3],
    ['Arroz integral (crudo)', 350, 7.5, 74, 2.7],
    ['Arroz basmati (crudo)', 350, 8, 77, 0.6],
    ['Pasta (cruda)', 355, 12.5, 71, 1.5],
    ['Pasta cocida', 158, 5.8, 31, 0.9],
    ['Pasta integral (cruda)', 350, 13, 64, 2.5],
    ['Copos de avena', 370, 13.5, 59, 7],
    ['Cuscús (crudo)', 360, 12.8, 72, 1.7],
    ['Quinoa (cruda)', 368, 14, 64, 6],
    ['Pan de barra', 260, 8.5, 51, 1.5],
    ['Pan integral', 240, 9, 41, 3.3],
    ['Pan de molde integral', 245, 10, 40, 4],
    ['Pan de centeno', 250, 8, 46, 2.5],
    ['Pan tostado / biscotes', 405, 12, 73, 6],
    ['Tortillas de trigo (wraps)', 300, 8.5, 50, 7],
    ['Harina de trigo', 345, 10, 72, 1.2],
    ['Harina de avena', 375, 13, 60, 7.5],
    ['Muesli sin azúcar añadido', 360, 9.5, 62, 6.5],
    ['Fideos de arroz (crudos)', 360, 6, 82, 0.5],
    ['Ñoquis de patata', 150, 3.5, 32, 0.5],
    ['Maíz dulce (lata, escurrido)', 80, 2.6, 14.5, 1.3],
  ]);

  cat('Tortitas', [
    ['Tortitas de arroz', 385, 8, 81, 2.8, '', 'Una tortita pesa unos 8 g (≈ 30 kcal).'],
    ['Tortitas de arroz integral', 380, 8.5, 78, 3],
    ['Tortitas de maíz', 380, 8, 79, 3.5, '', 'Una tortita pesa unos 8 g (≈ 30 kcal).'],
    ['Tortitas de lentejas', 360, 25, 53, 2],
    ['Tortitas de garbanzo', 375, 20, 57, 5],
  ]);

  cat('Tubérculos', [
    ['Patata', 77, 2, 17, 0.1],
    ['Boniato', 86, 1.6, 20, 0.1],
    ['Patata cocida', 86, 1.9, 20, 0.1],
    ['Yuca', 160, 1.4, 36, 0.3],
  ]);

  cat('Legumbres', [
    ['Lentejas (secas)', 330, 24, 49, 1.5],
    ['Lentejas cocidas (bote, escurridas)', 90, 7.5, 11.5, 0.5],
    ['Garbanzos (secos)', 350, 20.5, 45, 6],
    ['Garbanzos cocidos (bote, escurridos)', 120, 7, 15, 2.3],
    ['Alubias blancas (secas)', 300, 22, 40, 1.5, '', 'Muy ricas en fibra, que también aporta calorías.'],
    ['Alubias cocidas (bote, escurridas)', 90, 6.5, 12, 0.5],
    ['Guisantes congelados', 77, 5.4, 10, 0.4],
    ['Edamame', 121, 12, 9, 5.2],
    ['Habas', 70, 6, 8, 0.4],
  ]);

  cat('Verduras y hortalizas', [
    ['Lechuga / ensalada variada', 15, 1.3, 1.5, 0.2],
    ['Espinacas', 23, 2.9, 1.4, 0.4],
    ['Rúcula', 25, 2.6, 2, 0.7],
    ['Canónigos', 20, 2, 1, 0.4],
    ['Brócoli', 34, 2.8, 4, 0.4],
    ['Coliflor', 25, 1.9, 3, 0.3],
    ['Tomate', 20, 0.9, 3.5, 0.2],
    ['Tomate cherry', 25, 1, 4, 0.2],
    ['Pepino', 13, 0.6, 2, 0.1],
    ['Pimiento rojo', 30, 1, 5, 0.3],
    ['Pimiento verde', 20, 0.9, 3, 0.2],
    ['Cebolla', 38, 1.1, 7.5, 0.1],
    ['Ajo', 140, 6, 28, 0.5],
    ['Zanahoria', 38, 0.9, 7.5, 0.2],
    ['Calabacín', 17, 1.2, 2.2, 0.3],
    ['Berenjena', 24, 1, 3, 0.2],
    ['Calabaza', 26, 1, 5.5, 0.1],
    ['Champiñones', 22, 3, 2.3, 0.3],
    ['Judías verdes', 31, 1.8, 4, 0.2],
    ['Espárragos verdes', 20, 2.2, 2, 0.1],
    ['Espárragos blancos (bote)', 20, 2, 2, 0.2],
    ['Alcachofa', 47, 3.3, 5, 0.2],
    ['Puerro', 30, 1.5, 6, 0.3],
    ['Col / repollo', 25, 1.3, 4.5, 0.1],
    ['Coles de Bruselas', 43, 3.4, 5, 0.3],
    ['Apio', 15, 0.7, 1.5, 0.2],
    ['Remolacha cocida', 44, 1.7, 8, 0.2],
    ['Tomate triturado (lata)', 25, 1.2, 4, 0.2],
    ['Verduras congeladas para salteado', 40, 2.5, 5.5, 0.4],
  ]);

  cat('Frutas', [
    ['Manzana', 52, 0.3, 12, 0.2],
    ['Plátano', 89, 1.1, 20, 0.3, '', 'Un plátano mediano pelado pesa unos 120 g.'],
    ['Naranja', 45, 0.9, 9.4, 0.1],
    ['Mandarina', 53, 0.8, 11.5, 0.3],
    ['Pera', 57, 0.4, 12, 0.1],
    ['Fresas', 32, 0.7, 5.7, 0.3],
    ['Uvas', 69, 0.7, 17, 0.2],
    ['Melocotón', 40, 0.9, 8.5, 0.3],
    ['Nectarina', 44, 1.1, 9, 0.3],
    ['Kiwi', 61, 1.1, 11.7, 0.5],
    ['Piña', 50, 0.5, 11.5, 0.1],
    ['Melón', 34, 0.8, 8, 0.2],
    ['Sandía', 30, 0.6, 7.5, 0.2],
    ['Mango', 60, 0.8, 13.4, 0.4],
    ['Arándanos', 57, 0.7, 12, 0.3],
    ['Frambuesas', 52, 1.2, 5.4, 0.7],
    ['Cerezas', 63, 1.1, 13.9, 0.2],
    ['Higos', 74, 0.8, 16, 0.3],
    ['Ciruela', 46, 0.7, 10, 0.3],
    ['Granada', 83, 1.7, 14.7, 1.2],
    ['Limón', 29, 1.1, 6.5, 0.3],
    ['Dátiles', 277, 1.8, 68, 0.2],
    ['Pasas', 299, 3.1, 75, 0.5],
    ['Compota de manzana sin azúcar', 45, 0.2, 10.5, 0.1],
  ]);

  cat('Frutos secos y semillas', [
    ['Almendras', 600, 21, 7, 53],
    ['Nueces', 690, 15, 7, 65],
    ['Avellanas', 650, 15, 7, 61],
    ['Anacardos', 590, 18, 27, 46],
    ['Pistachos (sin cáscara)', 580, 20, 18, 45],
    ['Cacahuetes tostados', 600, 25, 13, 50],
    ['Crema de cacahuete 100 %', 610, 25, 12, 50],
    ['Semillas de chía', 490, 17, 8, 31, '', 'Casi todos sus hidratos son fibra (≈ 34 g por 100 g).'],
    ['Semillas de lino', 530, 18, 1.6, 42],
    ['Semillas de girasol (peladas)', 600, 21, 11, 51],
    ['Semillas de calabaza', 570, 30, 4.7, 49],
    ['Semillas de sésamo', 600, 18, 11.6, 50],
    ['Coco rallado', 660, 6.9, 7.4, 64],
  ]);

  cat('Grasas y aceites', [
    ['Aceite de oliva virgen extra', 900, 0, 0, 100, '', 'Una cucharada sopera son unos 10 g (≈ 90 kcal).'],
    ['Mantequilla', 740, 0.6, 0.6, 82],
    ['Aguacate', 160, 1.9, 1.9, 15],
    ['Aceitunas verdes', 140, 1, 0.5, 14.5, '', 'Peso sin hueso.'],
    ['Aceitunas negras', 190, 1.5, 1, 20, '', 'Peso sin hueso.'],
  ]);

  cat('Bebidas', [
    ['Agua', 0, 0, 0, 0, '100 ml'],
    ['Café solo', 2, 0.1, 0, 0, '100 ml'],
    ['Zumo de naranja natural', 45, 0.7, 10, 0.2, '100 ml'],
    ['Infusión / té (sin azúcar)', 1, 0, 0.2, 0, '100 ml'],
    ['Refresco de cola zero', 0, 0, 0, 0, '100 ml'],
    ['Refresco zero de sabores (naranja, limón…)', 2, 0, 0.3, 0, '100 ml'],
    ['Tónica zero', 2, 0, 0.4, 0, '100 ml'],
    ['Cerveza 0,0 sin alcohol', 21, 0.3, 4.5, 0, '100 ml'],
    ['Gazpacho', 50, 0.8, 4, 3.3, '100 ml'],
  ]);

  cat('Suplementos', [
    ['Proteína de suero (whey concentrada)', 390, 75, 8, 6, '', 'Un cacito suele ser de 30 g (≈ 117 kcal).'],
    ['Proteína de suero aislada (isolate)', 365, 88, 1.5, 0.5],
    ['Barrita de proteínas (media)', 360, 30, 35, 12, '', 'Varía mucho según la marca.'],
  ]);

  cat('Salsas y condimentos', [
    ['Mostaza', 90, 5, 4, 5.5],
    ['Salsa de soja', 55, 8, 5, 0.5],
    ['Hummus', 290, 7, 12, 23],
    ['Vinagre', 20, 0, 0.5, 0],
    ['Caldo de pollo', 5, 0.5, 0.3, 0.2, '100 ml'],
  ]);

  cat('Otros', [
    ['Miel', 304, 0.3, 82, 0],
    ['Cacao puro en polvo (desgrasado)', 340, 21, 13, 11, '', 'Muy rico en fibra, que también aporta calorías.'],
    ['Chocolate negro 85 %', 600, 11, 15, 50],
  ]);

  window.FOODS_DEFAULT = list;
})();

/* Bloques de equivalencia: alimentos parecidos en macronutrientes y calorías.
 * Cada bloque tiene un macronutriente de referencia y una cantidad (p. ej. 25 g de proteína);
 * la app calcula los gramos de cada alimento que aportan esa cantidad. Pesos en crudo.
 * Se cargan una sola vez; después el entrenador puede editarlos o crear los suyos. */
window.FOOD_BLOCKS_DEFAULT = [
  { id: 'blk-aves', family: 'Proteínas', name: 'Aves magras', macro: 'protein', amount: 25,
    foods: ['Pechuga de pollo (cruda)', 'Pechuga de pavo (cruda)', 'Fiambre de pechuga de pavo', 'Fiambre de pechuga de pollo'] },
  { id: 'blk-carnes-magras', family: 'Proteínas', name: 'Carnes magras', macro: 'protein', amount: 25,
    foods: ['Ternera magra (cruda)', 'Solomillo de cerdo (crudo)', 'Lomo de cerdo (crudo)', 'Conejo (crudo)', 'Muslo de pollo sin piel (crudo)', 'Jamón cocido extra', 'Lomo embuchado'] },
  { id: 'blk-carnes-grasas', family: 'Proteínas', name: 'Carnes con más grasa', macro: 'protein', amount: 25,
    foods: ['Carne picada de vacuno (cruda)', 'Hamburguesa de vacuno (cruda)', 'Hamburguesa de pollo (cruda)', 'Cordero pierna (crudo)', 'Pollo entero con piel (crudo)', 'Jamón serrano', 'Jamón ibérico'] },
  { id: 'blk-pescado-blanco', family: 'Proteínas', name: 'Pescado blanco y marisco', macro: 'protein', amount: 25,
    foods: ['Merluza (cruda)', 'Bacalao fresco (crudo)', 'Bacalao desalado (crudo)', 'Lubina (cruda)', 'Atún al natural (lata, escurrido)', 'Gambas peladas congeladas (crudas)', 'Langostinos / gambas cocidos', 'Calamar (crudo)', 'Sepia (cruda)', 'Pulpo (crudo)', 'Mejillones (crudos)'] },
  { id: 'blk-pescado-azul', family: 'Proteínas', name: 'Pescado azul y semigraso', macro: 'protein', amount: 25,
    foods: ['Salmón fresco (crudo)', 'Atún fresco (crudo)', 'Emperador / pez espada (crudo)', 'Sardinas frescas (crudas)', 'Boquerones frescos (crudos)', 'Dorada (cruda)'] },
  { id: 'blk-conservas', family: 'Proteínas', name: 'Conservas en aceite y ahumados', macro: 'protein', amount: 25,
    foods: ['Atún en aceite de oliva (lata, escurrido)', 'Sardinas en aceite (lata, escurridas)', 'Caballa en aceite (lata, escurrida)', 'Salmón ahumado'] },
  { id: 'blk-huevos', family: 'Proteínas', name: 'Huevos', macro: 'protein', amount: 25,
    foods: ['Huevo entero', 'Clara de huevo'] },
  { id: 'blk-lacteos-proteicos', family: 'Proteínas', name: 'Claras y lácteos proteicos', macro: 'protein', amount: 25,
    foods: ['Clara de huevo', 'Queso fresco batido 0 %', 'Yogur proteico natural', 'Skyr natural', 'Queso cottage', 'Requesón', 'Queso fresco tipo Burgos light', 'Proteína de suero (whey concentrada)'] },
  { id: 'blk-proteina-vegetal', family: 'Proteínas', name: 'Proteína vegetal', macro: 'protein', amount: 25,
    foods: ['Tofu firme', 'Seitán', 'Tempeh', 'Soja texturizada (seca)', 'Edamame'] },

  { id: 'blk-cereales', family: 'Hidratos de carbono', name: 'Cereales (en crudo)', macro: 'carbs', amount: 40,
    foods: ['Arroz blanco (crudo)', 'Arroz integral (crudo)', 'Arroz basmati (crudo)', 'Pasta (cruda)', 'Pasta integral (cruda)', 'Copos de avena', 'Harina de avena', 'Cuscús (crudo)', 'Quinoa (cruda)', 'Fideos de arroz (crudos)', 'Muesli sin azúcar añadido'] },
  { id: 'blk-pan', family: 'Hidratos de carbono', name: 'Pan y tortitas', macro: 'carbs', amount: 40,
    foods: ['Pan de barra', 'Pan integral', 'Pan de molde integral', 'Pan de centeno', 'Pan tostado / biscotes', 'Tortillas de trigo (wraps)', 'Tortitas de arroz', 'Tortitas de arroz integral', 'Tortitas de maíz', 'Tortitas de lentejas', 'Tortitas de garbanzo'] },
  { id: 'blk-tuberculos', family: 'Hidratos de carbono', name: 'Tubérculos', macro: 'carbs', amount: 40,
    foods: ['Patata', 'Boniato', 'Yuca', 'Ñoquis de patata'] },
  { id: 'blk-legumbres-secas', family: 'Hidratos de carbono', name: 'Legumbres (en seco)', macro: 'carbs', amount: 40,
    foods: ['Lentejas (secas)', 'Garbanzos (secos)', 'Alubias blancas (secas)'] },
  { id: 'blk-legumbres-cocidas', family: 'Hidratos de carbono', name: 'Legumbres cocidas (bote)', macro: 'carbs', amount: 40,
    foods: ['Lentejas cocidas (bote, escurridas)', 'Garbanzos cocidos (bote, escurridos)', 'Alubias cocidas (bote, escurridas)', 'Guisantes congelados', 'Habas', 'Maíz dulce (lata, escurrido)'] },
  { id: 'blk-fruta', family: 'Hidratos de carbono', name: 'Fruta (una ración)', macro: 'carbs', amount: 15,
    foods: ['Manzana', 'Plátano', 'Naranja', 'Mandarina', 'Pera', 'Fresas', 'Uvas', 'Melocotón', 'Nectarina', 'Kiwi', 'Piña', 'Melón', 'Sandía', 'Mango', 'Arándanos', 'Frambuesas', 'Cerezas', 'Ciruela', 'Higos', 'Granada'] },

  { id: 'blk-grasas', family: 'Grasas', name: 'Aceite, aguacate y aceitunas', macro: 'fat', amount: 10,
    foods: ['Aceite de oliva virgen extra', 'Mantequilla', 'Aguacate', 'Aceitunas verdes', 'Aceitunas negras'] },
  { id: 'blk-frutos-secos', family: 'Grasas', name: 'Frutos secos y semillas', macro: 'fat', amount: 10,
    foods: ['Almendras', 'Nueces', 'Avellanas', 'Anacardos', 'Pistachos (sin cáscara)', 'Cacahuetes tostados', 'Crema de cacahuete 100 %', 'Semillas de chía', 'Semillas de lino', 'Semillas de girasol (peladas)', 'Semillas de calabaza', 'Semillas de sésamo'] },

  { id: 'blk-leche', family: 'Lácteos', name: 'Leche y yogures', macro: 'protein', amount: 6.5,
    foods: ['Leche entera', 'Leche semidesnatada', 'Leche desnatada', 'Leche sin lactosa semidesnatada', 'Bebida de soja sin azúcar', 'Yogur natural', 'Yogur natural desnatado', 'Kéfir natural'] },
  { id: 'blk-quesos', family: 'Lácteos', name: 'Quesos', macro: 'protein', amount: 7,
    foods: ['Queso curado', 'Queso semicurado', 'Queso en lonchas (tipo gouda)', 'Queso en lonchas light', 'Queso rallado', 'Mozzarella fresca', 'Queso de cabra (rulo)', 'Queso fresco tipo Burgos'] },
];
