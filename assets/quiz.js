/* Рикс+С — квиз перед заявкой.
   4–6 коротких вопросов под каждую услугу, чтобы менеджер сразу понимал задачу.
   Тигр бежит по дорожке как в игре; кнопка «Устал(а), позвоните мне» видна всегда.
   Открывается: при отправке любой формы заявки, по ссылкам на #lead / #form и по [data-quiz="ключ"]. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  const DESIGN = { id: 'design', q: 'Макет есть?', type: 'one', opts: ['Есть готовый макет', 'Есть логотип, нужен дизайн', 'Ничего нет — нужен дизайн с нуля'], hint: 'Дизайнер нарисует в вашем фирменном стиле. Свой макет — по техтребованиям наших станков, подскажем.' };
  const WHEN = { id: 'when', q: 'Когда нужно?', type: 'one', opts: ['Срочно, на этой неделе', 'В течение 2–3 недель', 'Не горит, присматриваюсь'] };

  const QUIZZES = {
    vyveski: { title: 'Вывеска', intro: 'Цену вывески честно называем только после замера и предсогласования — от размера, материалов и крепления зависит всё. Ответьте на 5 вопросов, и менеджер придёт к разговору подготовленным.', qs: [
      { id: 'what', q: 'Что нужно?', type: 'one', opts: ['Объёмные световые буквы', 'Панель-кронштейн (двусторонняя)', 'Табличка «Режим работы»', 'Световая панель в окно (до 50×50 см)', 'Табличка на дом / аншлаг', 'Пока не знаю — нужна консультация'] },
      { id: 'where', q: 'Где будет вывеска?', type: 'one', opts: ['На фасаде, 1 этаж', 'На фасаде, выше 1 этажа', 'Отдельно стоящее здание', 'Внутри помещения'], hint: 'Световые короба на фасадах в Йошкар-Оле запрещены — для фасада делаем объёмные буквы прямого или контражурного свечения.' },
      { id: 'center', q: 'Здание в историческом центре?', type: 'one', opts: ['Да', 'Нет', 'Не знаю'], hint: 'В историческом центре вывеску согласуем ещё и с Минкультуры — это мы берём на себя.', skip: a => a.where === 'Внутри помещения' },
      { id: 'size', q: 'Примерный размер вывески', type: 'size', unit: 'см', hint: 'Не знаете — не страшно, приедем на замер.' },
      { id: 'have', q: 'Что уже есть?', type: 'many', opts: ['Логотип в векторе', 'Фото фасада', 'Адрес точки', 'Товарный знак', 'Ничего из этого'], hint: 'Вывеску на английском согласуют только при зарегистрированном товарном знаке.' },
      { id: 'addr', q: 'Адрес точки (если знаете)', type: 'text', ph: 'ул. …, д. …', opt: true }
    ]},
    neon: { title: 'Неоновая вывеска', intro: '5 вопросов — и пришлём эскиз с ценой.', qs: [
      { id: 'where', q: 'Где будет неон?', type: 'one', opts: ['В помещении / зал', 'В витрине', 'Фотозона, мероприятие', 'Дома / в подарок'] },
      { id: 'what', q: 'Что светим?', type: 'one', opts: ['Готовая надпись («Открыто», «Кофе с собой»…)', 'Логотип', 'Своя надпись', 'Картинка / символ'] },
      { id: 'text', q: 'Текст или идея', type: 'text', ph: 'напр. «Красота — это ты»', opt: true },
      { id: 'size', q: 'Размер по длинной стороне', type: 'one', opts: ['около 50 см', 'около 80 см', 'около 1 м', 'больше 1 м', 'не знаю'] },
      { id: 'color', q: 'Цвет', type: 'many', opts: ['Тёплый белый', 'Холодный белый', 'Красный', 'Оранжевый', 'Жёлтый', 'Зелёный', 'Голубой', 'Синий', 'Фиолетовый', 'Подберите вы'] },
      { id: 'mount', q: 'Крепление', type: 'one', opts: ['На стену', 'Подвесное', 'На подставке'] }
    ]},
    transport: { title: 'Реклама на транспорте', intro: 'Ответьте на 5 вопросов — подберём вариант и посчитаем изготовление и монтаж.', qs: [
      { id: 'what', q: 'Что оклеиваем?', type: 'one', opts: ['Легковой автомобиль', 'Газель / фургон', 'Троллейбус', 'Другой транспорт'] },
      { id: 'area', q: 'Сколько оклеиваем?', type: 'one', opts: ['Только логотип / надписи', 'Частично (борта)', 'Полностью'] },
      { id: 'trolley', q: 'Как устроена реклама на троллейбусе', type: 'info', text: 'Аренду места вы заключаете напрямую с троллейбусным парком: договор на 6 месяцев, оплата помесячно. Мы делаем макет, печать на плёнке и монтаж. Официальные тарифы парка пришлёт менеджер.', skip: a => a.what !== 'Троллейбус' },
      DESIGN,
      { id: 'law', q: 'Важно про текст рекламы', type: 'info', text: 'Монтаж запускаем только после юридического заключения, что реклама не нарушает закон о рекламе. Поможем с этим — так вас не оштрафуют.' },
      WHEN
    ]},
    stendy: { title: 'Информационный стенд', intro: 'Пара вопросов — и сразу скажем, что влезет в стенд и сколько это стоит.', qs: [
      { id: 'what', q: 'Какой стенд?', type: 'one', opts: ['Уголок потребителя', 'План эвакуации', 'Антитеррор / пожарная безопасность / ГО и ЧС', 'Стенд с символикой', 'Свой информационный стенд'] },
      { id: 'bti', q: 'Есть копия плана БТИ?', type: 'one', opts: ['Есть', 'Нет', 'Не знаю'], hint: 'Для плана эвакуации нужна копия плана БТИ и места огнетушителей. Дизайн входит в стоимость.', skip: a => a.what !== 'План эвакуации' },
      { id: 'shape', q: 'Форма', type: 'one', opts: ['Прямоугольный', 'Фигурный'], skip: a => a.what === 'План эвакуации' },
      { id: 'size', q: 'Размер стенда', type: 'size', unit: 'мм', hint: 'Стандарт: уголок потребителя 730×530, тематические 1000×800.', skip: a => a.what === 'План эвакуации' },
      { id: 'pockets', q: 'Карманы', type: 'pockets', skip: a => a.what === 'План эвакуации' },
      DESIGN
    ]},
    stojki: { title: 'Мобильная стойка', intro: '5 вопросов — подберём стойку под задачу.', qs: [
      { id: 'what', q: 'Какая стойка?', type: 'one', opts: ['«Паук» — от 4 750 ₽', 'Ролл Ап — от 9 000 ₽', 'Виндер (флаг) — от 11 000 ₽', 'Пресс Волл / фотозона — от 15 700 ₽', 'Помогите выбрать'] },
      { id: 'size', q: 'Размер', type: 'one', dyn: a => /Паук/.test(a.what) ? ['800×1800 мм — 4 750 ₽', '950×1950 мм — 5 550 ₽', '1100×2200 мм — 6 750 ₽'] : /Ролл/.test(a.what) ? ['850×2000 мм — 9 000 ₽', '1000×2000 мм — 9 300 ₽', '1200×2000 мм — 13 000 ₽', '«Капля» 850×2000 мм — 13 200 ₽'] : /Виндер/.test(a.what) ? ['Сетка, 1,8 м — 11 000 ₽', 'Блэкаут, двусторонний, 1,8 м — 15 500 ₽'] : /Пресс/.test(a.what) ? ['2000×3000 мм — 15 700 ₽', '2000×3000 мм с усилением — 17 400 ₽', 'Другой размер'] : ['Пока не знаю'], skip: a => /Помогите/.test(a.what || '') },
      { id: 'need', q: 'Нужна новая стойка или только полотно?', type: 'one', opts: ['Стойка с полотном', 'Только полотно — стойка есть'], hint: 'Доп. полотно на «Паук» — 2 400 ₽, меняете сами за минуту. Замена полотна на ролл-апе — 2 000 ₽ + полотно.' },
      { id: 'for', q: 'Для чего?', type: 'one', opts: ['Выставка / ярмарка', 'У входа в точку', 'Фотозона на мероприятие', 'Другое'] },
      DESIGN,
      WHEN
    ]},
    poligrafiya: { title: 'Полиграфия', intro: '5 вопросов — и сразу назовём цену. Срок печати — 6–8 рабочих дней после согласования макета.', qs: [
      { id: 'what', q: 'Что печатаем?', type: 'one', opts: ['Визитки', 'Листовки / флаеры', 'Буклеты / лифлеты', 'Купоны / сертификаты', 'Открытки', 'Наклейки', 'Другое'] },
      { id: 'fmt', q: 'Формат', type: 'one', dyn: a => ({
        'Визитки': ['50×90 — от 4 000 ₽ / 1000 шт', 'Евро 55×85 — от 4 500 ₽', 'С ламинацией — от 4 700 ₽', 'Со скруглёнными углами — от 5 000 ₽', 'С отверстием — от 5 000 ₽'],
        'Листовки / флаеры': ['А7 — от 2 500 ₽ / 1000 шт', 'А6 — от 3 900 ₽', 'А5 — от 4 500 ₽', 'А4 — от 8 800 ₽', 'Минифлаер 150×90 — от 3 600 ₽', 'Еврофлаер 210×99 — от 4 100 ₽'],
        'Буклеты / лифлеты': ['А6 в А7 — от 4 800 ₽', 'Минибуклет 150×90 — от 5 500 ₽', 'А5 в А6 — от 6 200 ₽', 'Евробуклет — от 6 800 ₽', 'Лифлет А4 в накидку — от 8 700 ₽', 'Лифлет А4 гармошкой — от 9 700 ₽'],
        'Купоны / сертификаты': ['Купон 1/3 А4', 'Сертификат 1/3 А4', 'Сертификат А5'],
        'Открытки': ['99×210', '210×148', 'Еврооткрытка'],
        'Наклейки': ['Круг / квадрат 30 мм', '40 мм', '50 мм', '40×55 мм', '50×90 мм', 'Своя форма']
      }[a.what] || ['Расскажу менеджеру']) },
      { id: 'qty', q: 'Тираж', type: 'one', opts: ['100', '200', '500', '1000', '2500', '5000', 'Другой'], hint: 'Чем больше тираж — тем дешевле каждая штука.' },
      { id: 'sides', q: 'Печать', type: 'one', opts: ['С одной стороны', 'С двух сторон'], skip: a => a.what === 'Наклейки' },
      DESIGN,
      WHEN
    ]}
  };
  QUIZZES.nakleyki = { title: 'Наклейки', intro: '4 вопроса — и посчитаем тираж наклеек.', qs: [
    { id: 'for', q: 'Для чего наклейки?', type: 'one', opts: ['На упаковку / коробку', 'На продукцию (бирка, этикетка)', 'Стикерпак / подарок', 'На витрину / стекло', 'Другое'] },
    { id: 'mat', q: 'Материал', type: 'one', opts: ['Плёнка глянцевая', 'Плёнка матовая', 'Прозрачная плёнка', 'Самоклеящаяся бумага', 'Объёмные (смоляные)', 'Подскажите'] },
    { id: 'size', q: 'Размер и форма', type: 'one', opts: ['Круг / квадрат 30 мм', '40 мм', '50 мм', '40×55 мм', '50×90 мм', 'Своя форма (фигурная)'] },
    { id: 'qty', q: 'Тираж', type: 'one', opts: ['100', '200', '500', '1000', 'Больше'], hint: '200 наклеек 30 мм — 900 ₽, 1000 шт — 2 600 ₽. Чем больше тираж, тем дешевле штука.' },
    DESIGN
  ]};
  QUIZZES.pechat = { title: 'Широкоформатная печать', intro: '4 вопроса — и посчитаем печать по метражу.', qs: [
    { id: 'what', q: 'Что печатаем?', type: 'one', opts: ['Баннер (улица)', 'Плёнка на витрину / стекло', 'Плёнка на стену / мебель', 'Аппликация из цветной плёнки', 'Постер / интерьер'] },
    { id: 'size', q: 'Размер', type: 'size', unit: 'см', hint: 'Ширина печати: баннер до 3,15 м, плёнка до 1,56 м — больше склеим.' },
    { id: 'fin', q: 'Обработка', type: 'many', opts: ['Проклейка по периметру', 'Люверсы', 'Ламинация (защита от выцветания)', 'Монтаж', 'Не знаю'] },
    DESIGN,
    WHEN
  ]};
  QUIZZES.suveniry = { title: 'Сувениры с логотипом', intro: '4 вопроса — и пришлём расчёт.', qs: [
    { id: 'what', q: 'Что брендируем?', type: 'many', opts: ['Ручки', 'Карандаши', 'Кружки', 'Другое'] },
    { id: 'qty', q: 'Тираж', type: 'one', opts: ['до 100', '100–300', '300–500', 'больше 500'], hint: 'Ручки и карандаши — от 100 шт, срок 14 рабочих дней после согласования макета.' },
    { id: 'for', q: 'Повод', type: 'one', opts: ['Подарки клиентам', 'Мероприятие / выставка', 'Для сотрудников', 'Другое'] },
    DESIGN
  ]};
  QUIZZES.interier = { title: 'Оформление помещения', intro: '5 вопросов — поймём масштаб и приедем с идеями.', qs: [
    { id: 'what', q: 'Что оформляем?', type: 'many', opts: ['Зона ресепшн с логотипом', 'Таблички на кабинеты', 'Указатели по коридору', 'Витрины', 'Стены (печать, аппликация)', 'Школа / учреждение'] },
    { id: 'obj', q: 'Что за помещение?', type: 'one', opts: ['Салон / студия', 'Офис', 'Магазин / кафе', 'Школа / детсад', 'Медицина', 'Другое'] },
    { id: 'area', q: 'Примерная площадь', type: 'one', opts: ['до 30 м²', '30–100 м²', 'больше 100 м²', 'не знаю'] },
    { id: 'pack', q: 'Нужен «базовый пакет»?', type: 'one', opts: ['Да: вывеска + режим работы + уголок потребителя', 'Нет, только оформление', 'Расскажите подробнее'], hint: 'Базовый пакет — то, что обязательно по закону: вывеска, режим работы, уголок потребителя (и план эвакуации, если нужен).' },
    DESIGN
  ]};
  QUIZZES.shtendery = { title: 'Штендер', intro: '4 вопроса — подберём штендер под вход и посчитаем.', qs: [
    { id: 'type', q: 'Какой штендер?', type: 'one', opts: ['Двусторонний «домик»', 'Односторонний на опоре', 'С меловой / маркерной доской', 'Со сменными плакатами (клик-рамка)', 'Помогите выбрать'] },
    { id: 'size', q: 'Размер поля', type: 'one', opts: ['А1 (594×841)', 'А0 (841×1189)', 'Свой размер', 'Не знаю'] },
    { id: 'where', q: 'Где будет стоять?', type: 'one', opts: ['На улице у входа', 'В помещении / ТЦ', 'И там, и там'], hint: 'Для улицы — утяжелённое основание и влагостойкая печать, ветер не уронит.' },
    DESIGN,
    WHEN
  ]};
  QUIZZES.figury = { title: 'Ростовая фигура', intro: '4 вопроса — и пришлём эскиз фигуры.', qs: [
    { id: 'who', q: 'Кто или что на фигуре?', type: 'one', opts: ['Человек в полный рост (сотрудник, звезда)', 'Персонаж / маскот', 'Продукт / упаковка', 'Фотозона с прорезью для лица', 'Своя идея'] },
    { id: 'h', q: 'Высота', type: 'one', opts: ['около 1 м', 'около 1,5 м', 'в рост — 1,8 м', 'выше 2 м', 'не знаю'] },
    { id: 'mat', q: 'Материал', type: 'one', opts: ['ПВХ 5 мм (лёгкая, для помещения)', 'Композит (для улицы, надолго)', 'Пенокартон (на одно мероприятие)', 'Подскажите'] },
    { id: 'photo', q: 'Фото для печати есть?', type: 'one', opts: ['Есть качественное фото', 'Есть, но надо обработать', 'Нужна съёмка / рисунок'] },
    WHEN
  ]};
  QUIZZES.penoplast = { title: 'Изделия из пенопласта', intro: '4 вопроса — и посчитаем фигурную резку.', qs: [
    { id: 'what', q: 'Что вырезаем?', type: 'one', opts: ['Объёмные буквы / логотип', 'Цифры и надписи для фотозоны', 'Декор (фигуры, облака, звёзды)', 'Интерьерная вывеска', 'Другое'] },
    { id: 'size', q: 'Высота буквы / фигуры', type: 'one', opts: ['до 30 см', '30–60 см', '60–100 см', 'больше 1 м'] },
    { id: 'fin', q: 'Отделка', type: 'one', opts: ['Покраска в цвет', 'Оклейка плёнкой', 'Без покраски (белый)', 'Подскажите'], hint: 'Пенопласт лёгкий: крепим на скотч или монтажный клей, без сверления.' },
    { id: 'where', q: 'Где будет стоять?', type: 'one', opts: ['В помещении', 'Фотозона на мероприятии', 'На улице (временно)'] },
    DESIGN
  ]};
  QUIZZES.brajl = { title: 'Таблички Брайля и знаки', intro: '4 вопроса — подберём таблички и знаки по требованиям доступной среды.', qs: [
    { id: 'what', q: 'Что нужно?', type: 'many', opts: ['Табличка со шрифтом Брайля', 'Мнемосхема для незрячих', 'Знаки пожарной безопасности', 'Знаки эвакуации (фотолюминесцентные)', 'Предупреждающие / запрещающие знаки', 'Тактильная плитка / наклейки'] },
    { id: 'obj', q: 'Для какого объекта?', type: 'one', opts: ['Школа / детсад', 'Магазин / офис', 'Медицинское учреждение', 'Госучреждение', 'Другое'] },
    { id: 'qty', q: 'Сколько табличек / знаков?', type: 'one', opts: ['1–5', '6–20', 'больше 20', 'Нужен аудит — не знаю'] },
    { id: 'check', q: 'Есть предписание или проверка?', type: 'one', opts: ['Да, есть срок', 'Нет, делаем заранее'], hint: 'Сделаем по ГОСТ — проверка вопросов не задаст.' }
  ]};
  QUIZZES.shkoly = { title: 'Оформление школы или детсада', intro: '5 вопросов — и приедем с готовыми идеями.', qs: [
    { id: 'obj', q: 'Учреждение', type: 'one', opts: ['Школа', 'Детский сад', 'Колледж / техникум', 'Центр допобразования'] },
    { id: 'what', q: 'Что оформляем?', type: 'many', opts: ['Стенды (уголок потребителя, антитеррор, ПБ)', 'Классные уголки, расписание', 'Холл, коридоры, рекреации', 'Музыкальный / спортзал', 'Таблички на кабинеты', 'Паспорт доступности, знаки, Брайль'] },
    { id: 'pay', q: 'Как оплачиваете?', type: 'one', opts: ['Бюджет (договор по 44-ФЗ / 223-ФЗ)', 'Родительский комитет / спонсор', 'Внебюджет'], hint: 'Работаем с бюджетными организациями: договор, счёт, УПД через СБИС, оплата после поставки.' },
    { id: 'when', q: 'К какому сроку?', type: 'one', opts: ['К 1 сентября', 'К проверке', 'В течение месяца', 'Не горит'] },
    DESIGN
  ]};
  QUIZZES.logotip = { title: 'Логотип и товарный знак', intro: '4 вопроса — с этого начинается любая вывеска.', qs: [
    { id: 'what', q: 'Что нужно?', type: 'one', opts: ['Логотип с нуля', 'Обновить старый логотип', 'Логотип + фирменный стиль', 'Перевести логотип в вектор', 'Помочь с товарным знаком'] },
    { id: 'biz', q: 'Сфера бизнеса', type: 'text', ph: 'напр. кофейня, автосервис', opt: true },
    { id: 'en', q: 'Название на латинице?', type: 'one', opts: ['Да', 'Нет, кириллица', 'Пока не решили'], hint: 'Вывеску на английском согласуют только при зарегистрированном товарном знаке. Регистрация — около 18 месяцев, подскажем партнёров.' },
    WHEN
  ]};
  QUIZZES.general = { title: 'Заявка', intro: 'Пара вопросов — чтобы менеджер сразу понял задачу и не переспрашивал.', qs: [
    { id: 'svc', q: 'Что вас интересует?', type: 'one', opts: ['Вывеска', 'Неон', 'Реклама на транспорте', 'Информационный стенд', 'Мобильная стойка', 'Штендер', 'Ростовая фигура', 'Полиграфия', 'Наклейки', 'Широкоформатная печать', 'Оформление помещения', 'Школа / детсад', 'Таблички Брайля и знаки', 'Пенопласт', 'Логотип', 'Сувениры с логотипом', 'Другое'],
      branch: { 'Вывеска': 'vyveski', 'Неон': 'neon', 'Реклама на транспорте': 'transport', 'Информационный стенд': 'stendy', 'Мобильная стойка': 'stojki', 'Штендер': 'shtendery', 'Ростовая фигура': 'figury', 'Полиграфия': 'poligrafiya', 'Наклейки': 'nakleyki', 'Широкоформатная печать': 'pechat', 'Оформление помещения': 'interier', 'Школа / детсад': 'shkoly', 'Таблички Брайля и знаки': 'brajl', 'Пенопласт': 'penoplast', 'Логотип': 'logotip', 'Сувениры с логотипом': 'suveniry' } },
    { id: 'what', q: 'Коротко, что нужно?', type: 'text', ph: 'напр. табличка на дверь…', opt: true, skip: a => !!a.svc && a.svc !== 'Другое' }
  ]};

  const PAGE = { vyveski: 'vyveski', neon: 'neon', transport: 'transport', stendy: 'stendy', 'mobilnye-stojki': 'stojki', poligrafiya: 'poligrafiya', shtendery: 'shtendery', 'rostovye-figury': 'figury', penoplast: 'penoplast', 'tablichki-brajlya': 'brajl', 'oformlenie-shkol': 'shkoly', logotip: 'logotip' };
  const pageKey = () => document.body.dataset.quiz || PAGE[(location.pathname.split('/').pop() || '').replace('.html', '')] || 'general';
  const fromService = s => { s = (s || '').toLowerCase();
    if (/штендер/.test(s)) return 'shtendery'; if (/ростов|фигур/.test(s)) return 'figury'; if (/пенопл/.test(s)) return 'penoplast'; if (/брайл|знак/.test(s)) return 'brajl';
    if (/школ|детсад|детск/.test(s)) return 'shkoly'; if (/логотип|товарн/.test(s)) return 'logotip';
    if (/стойк|ролл|паук|виндер|пресс/.test(s)) return 'stojki'; if (/неон/.test(s)) return 'neon'; if (/вывес|букв|короб|кронштейн|табличк/.test(s)) return 'vyveski';
    if (/транспорт|авто|троллейб/.test(s)) return 'transport'; if (/стенд|уголок|эвакуац/.test(s)) return 'stendy'; if (/наклей|стикер/.test(s)) return 'nakleyki';
    if (/баннер|плёнк|пленк|широкоформат|печать/.test(s)) return 'pechat'; if (/сувенир|кружк|ручк/.test(s)) return 'suveniry'; if (/интерьер|ресепшн|оформлен|указател/.test(s)) return 'interier';
    if (/визит|листов|буклет|полиграф|флаер/.test(s)) return 'poligrafiya'; return ''; };

  // ----- стили (фирменные: красный, оранжевый, белый) -----
  const css = `
  .qz-scrim{position:fixed;inset:0;background:rgba(30,15,10,.55);z-index:200;display:none;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(3px)}
  .qz-scrim.on{display:flex}
  .qz{width:600px;max-width:100%;max-height:96vh;background:#fff;border-radius:22px;box-shadow:0 40px 90px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;font-family:inherit;color:#2B2A28}
  .qz-top{padding:16px 20px 0;display:flex;align-items:center;gap:10px}
  .qz-top b{font-size:15px;font-weight:800}
  .qz-top .qz-x{margin-left:auto;width:36px;height:36px;border-radius:10px;font-size:22px;color:#8a817a;background:#f6f1ed}
  .qz-run{position:relative;height:118px;margin:2px 20px 0}
  .qz-ground{position:absolute;left:0;right:0;bottom:10px;height:8px;border-radius:8px;background:repeating-linear-gradient(90deg,#f3d9c8 0 14px,#fbe9de 14px 28px)}
  .qz-fill{position:absolute;left:0;bottom:10px;height:8px;border-radius:8px;background:linear-gradient(90deg,#FF8A00,#E3241B);transition:width .5s cubic-bezier(.2,.7,.2,1)}
  .qz-coin{position:absolute;bottom:22px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#F7941D;border:2px solid #fff;box-shadow:0 0 0 2px #F7941D;transition:all .3s}
  .qz-coin.got{transform:translateY(-14px) scale(.2);opacity:0}
  .qz-flag{position:absolute;right:-4px;bottom:18px;font-size:22px}
  .qz-tiger{position:absolute;bottom:13px;width:66px;height:102px;margin-left:-33px;transition:left .6s cubic-bezier(.3,.6,.3,1);z-index:2}
  .qz-face{width:100%;height:100%;transform:scaleX(-1);transition:transform .25s}
  .qz-tiger.back .qz-face{transform:none}
  .qz-arch svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 4px 4px rgba(0,0,0,.22))}
  .qz-arch .qz-bd{animation:qzBob 2.6s ease-in-out infinite}
  @keyframes qzBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
  .qz-wr{transform-origin:184px 214px;animation:qzWr .55s ease-in-out infinite}
  @keyframes qzWr{0%,100%{transform:rotate(0)}25%{transform:rotate(-2.5deg) translate(-1px,1px)}50%{transform:rotate(1deg)}75%{transform:rotate(-1.5deg) translate(1px,0)}}
  .qz-ln{stroke-dasharray:46;stroke-dashoffset:46;animation:qzLn 4s linear infinite}
  .qz-ln:nth-child(2){animation-delay:.9s}.qz-ln:nth-child(3){animation-delay:1.8s}.qz-ln:nth-child(4){animation-delay:2.7s}
  @keyframes qzLn{0%{stroke-dashoffset:46}22%,88%{stroke-dashoffset:0}100%{stroke-dashoffset:46}}
  .qz-l1{transform-origin:133px 336px}.qz-l2{transform-origin:170px 336px}
  .qz-tiger.walk .qz-l1{animation:qzStep .2s ease-in-out 3 alternate}
  .qz-tiger.walk .qz-l2{animation:qzStep .2s ease-in-out 3 alternate-reverse}
  .qz-tiger.walk .qz-bd{animation:qzWalk .2s ease-in-out 3 alternate}
  .qz-tiger.walk .qz-wr{animation:none}
  @keyframes qzStep{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
  @keyframes qzWalk{from{transform:translateY(0)}to{transform:translateY(-6px)}}
  @keyframes qzhop{0%{transform:translateY(0)}35%{transform:translateY(-22px) rotate(-8deg)}70%{transform:translateY(0) rotate(4deg)}85%{transform:translateY(-4px)}100%{transform:none}}
  .qz-body{padding:8px 22px 6px;overflow-y:auto;flex:1}
  .qz-step{font-size:12px;font-weight:700;color:#E3241B;text-transform:uppercase;letter-spacing:.06em}
  .qz-q{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.2;margin:6px 0 14px}
  .qz-hint{font-size:13px;color:#7a6f67;background:#fff5ec;border-radius:10px;padding:9px 12px;margin-top:12px;line-height:1.45}
  .qz-warn{font-size:13px;color:#8a1b13;background:#fdecea;border-radius:10px;padding:9px 12px;margin-top:12px;line-height:1.45;font-weight:600}
  .qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .qz-opt{min-height:52px;text-align:left;padding:10px 14px;border-radius:12px;border:2px solid #eee3db;font-weight:700;font-size:14px;line-height:1.3;background:#fff;transition:all .15s}
  .qz-opt:hover{border-color:#F7941D}
  .qz-opt.on{border-color:#E3241B;background:#fff1ee;color:#B5161A}
  .qz-in{width:100%;height:52px;border-radius:12px;border:2px solid #eee3db;padding:0 14px;font-size:16px;font-weight:600;outline:none;background:#fff}
  .qz-in:focus{border-color:#F7941D}
  .qz-row{display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:center}
  .qz-row span{font-weight:700;color:#8a817a}
  .qz-chk{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:14px;font-weight:600;color:#7a6f67}
  .qz-pd{align-items:flex-start;font-size:12px;font-weight:500;line-height:1.45;border:1.5px solid transparent;border-radius:9px;padding:6px 8px;margin-left:-8px}.qz-pd input{margin-top:2px;width:17px;height:17px;flex:0 0 17px;accent-color:#E3241B}.qz-pd a{color:#B5161A;text-decoration:underline}.qz-pd.bad{border-color:#E3241B;background:#fdecea}
  .qz-foot{padding:12px 20px 16px;border-top:1px solid #f1e8e1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .qz-btn{height:50px;padding:0 22px;border-radius:12px;font-weight:800;font-size:15px}
  .qz-next{background:linear-gradient(115deg,#FF8A00,#FF5A1F 48%,#E3241B);color:#fff;margin-left:auto}
  .qz-next:hover{filter:brightness(1.06)}
  .qz-next:disabled{opacity:.4;cursor:not-allowed}
  .qz-back{border:2px solid #eee3db;color:#2B2A28}
  .qz-call{width:100%;height:46px;border-radius:12px;background:#fff5ec;color:#B5161A;font-weight:800;font-size:14px;border:2px dashed #F7941D;order:9}
  .qz-call:hover{background:#ffe9d6}
  .qz-done{text-align:center;padding:26px 10px}
  .qz-done .qz-arch{width:110px;height:170px;margin:0 auto}
  .qz-done h3{font-size:24px;font-weight:900;margin-top:10px}
  .qz-done p{color:#7a6f67;margin-top:8px}
  .qz-why{font-size:13px;color:#E3241B;font-weight:700;text-decoration:underline;margin-top:12px;display:inline-block;cursor:pointer}
  @media(max-width:560px){.qz-run{height:96px}.qz-tiger{width:54px;height:83px;margin-left:-27px}.qz-opts{grid-template-columns:1fr}.qz-q{font-size:19px}.qz{border-radius:18px}.qz-btn{padding:0 16px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // тигр-архитектор: голова из логотипа, белый халат, планшет и карандаш (смотрит влево; в беговой дорожке зеркалится)
  const ARCH = `<svg viewBox="0 0 260 400" aria-hidden="true"><defs><linearGradient id="qzFl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A00"/><stop offset=".5" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E3241B"/></linearGradient></defs><g class="qz-bd">
    <path d="M198 318 C230 314 244 288 234 262 C228 246 238 234 246 238" fill="none" stroke="#1A1513" stroke-width="15" stroke-linecap="round"/><path d="M198 318 C230 314 244 288 234 262 C228 246 238 234 246 238" fill="none" stroke="#FF7A1A" stroke-width="9" stroke-linecap="round"/><path d="M222 310l-4 10M236 288l-10 4M233 264l-10-2" stroke="#1A1513" stroke-width="4" stroke-linecap="round"/>
    <g class="qz-l1"><path d="M122 330 L118 378 L142 378 L144 330 Z" fill="#2A2320" stroke="#1A1513" stroke-width="4" stroke-linejoin="round"/><path d="M112 374 h30 a6 6 0 0 1 6 6 v8 h-42 v-6 a8 8 0 0 1 6-8z" fill="url(#qzFl)" stroke="#1A1513" stroke-width="4" stroke-linejoin="round"/></g>
    <g class="qz-l2"><path d="M158 330 L160 378 L184 378 L182 330 Z" fill="#2A2320" stroke="#1A1513" stroke-width="4" stroke-linejoin="round"/><path d="M156 374 h30 a6 6 0 0 1 6 6 v8 h-42 v-6 a8 8 0 0 1 6-8z" fill="url(#qzFl)" stroke="#1A1513" stroke-width="4" stroke-linejoin="round"/></g>
    <image href="img/logo-mark.png" x="22" y="18" width="190" height="205"/>
    <path d="M114 200 C100 250 96 300 90 342 Q150 352 208 342 C202 300 204 250 190 200 Z" fill="#fff" stroke="#1A1513" stroke-width="5" stroke-linejoin="round"/>
    <path d="M128 202 L150 262 L174 202 Z" fill="url(#qzFl)" stroke="#1A1513" stroke-width="3" stroke-linejoin="round"/>
    <path d="M146 206 h8 l3 34 l-7 9 l-7-9z" fill="#1A1513"/>
    <path d="M124 200 L134 226 L124 232 L150 264 L176 232 L166 226 L178 200" fill="none" stroke="#1A1513" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 264 V347" stroke="#1A1513" stroke-width="3"/><circle cx="150" cy="284" r="3.5" fill="#1A1513"/><circle cx="150" cy="308" r="3.5" fill="#1A1513"/>
    <path d="M173 274 v-15" stroke="#E3241B" stroke-width="5" stroke-linecap="round"/><path d="M182 274 v-18" stroke="#FF8A00" stroke-width="5" stroke-linecap="round"/>
    <path d="M165 270 h28 v18 h-28z" fill="#fff" stroke="#1A1513" stroke-width="3" stroke-linejoin="round"/>
    <path d="M104 312 h24 M172 312 h26" stroke="#1A1513" stroke-width="3" stroke-linecap="round"/>
    <path d="M122 214 C108 240 100 268 100 290" fill="none" stroke="#1A1513" stroke-width="26" stroke-linecap="round"/><path d="M122 214 C108 240 100 268 100 290" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
    <g transform="rotate(-10 80 262)"><rect x="44" y="222" width="70" height="84" rx="6" fill="#FFB43A" stroke="#1A1513" stroke-width="4"/><rect x="51" y="232" width="56" height="66" rx="2" fill="#fff" stroke="#1A1513" stroke-width="2.5"/><rect x="66" y="216" width="26" height="12" rx="3" fill="#2A2320" stroke="#1A1513" stroke-width="3"/>
      <g stroke="#8a817a" stroke-width="3.5" stroke-linecap="round"><path class="qz-ln" d="M58 246 h42"/><path class="qz-ln" d="M58 259 h36"/><path class="qz-ln" d="M58 272 h42"/><path class="qz-ln" d="M58 285 h26"/></g></g>
    <circle cx="100" cy="292" r="12" fill="#fff" stroke="#1A1513" stroke-width="4"/>
    <g class="qz-wr"><path d="M186 214 C178 250 150 262 120 256" fill="none" stroke="#1A1513" stroke-width="26" stroke-linecap="round"/><path d="M186 214 C178 250 150 262 120 256" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/><path d="M168 244l-3 11M152 252l-2 11" stroke="#1A1513" stroke-width="4" stroke-linecap="round"/>
      <path d="M128 236 L100 266" stroke="#1A1513" stroke-width="10" stroke-linecap="round"/><path d="M128 236 L104 262" stroke="#FF7A1A" stroke-width="5" stroke-linecap="round"/><circle cx="99" cy="267" r="2.5" fill="#1A1513"/>
      <circle cx="116" cy="252" r="12" fill="#fff" stroke="#1A1513" stroke-width="4"/></g>
  </g></svg>`;

  const root = document.createElement('div'); root.className = 'qz-scrim';
  root.innerHTML = '<div class="qz" role="dialog" aria-modal="true"><div class="qz-top"><b id="qzTitle"></b><button class="qz-x" aria-label="Закрыть">×</button></div>' +
    '<div class="qz-run"><div class="qz-ground"></div><div class="qz-fill"></div><div class="qz-coins"></div><div class="qz-flag">🏁</div><div class="qz-tiger"><div class="qz-face qz-arch">' + ARCH + '</div></div></div>' +
    '<div class="qz-body"></div><div class="qz-foot"></div></div>';
  document.body.appendChild(root);
  const body = $('.qz-body', root), foot = $('.qz-foot', root), tiger = $('.qz-tiger', root), fill = $('.qz-fill', root), coins = $('.qz-coins', root);

  let S = null; // состояние

  function steps() {
    // intro, вопросы (с ветвлением и пропусками), контакты
    const out = [{ t: 'intro' }];
    let qz = QUIZZES[S.key];
    const add = list => list.forEach(q => { if (!q.skip || !q.skip(S.ans)) out.push({ t: 'q', q }); });
    add(qz.qs);
    if (S.key === 'general' && S.branch) add(QUIZZES[S.branch].qs);
    out.push({ t: 'contact' });
    return out;
  }
  let lastPct = 0, walkT = 0;
  function walk(pct) {
    if (pct === lastPct) return;
    tiger.classList.toggle('back', pct < lastPct); lastPct = pct;
    tiger.classList.remove('walk'); void tiger.offsetWidth; tiger.classList.add('walk');
    clearTimeout(walkT); walkT = setTimeout(() => tiger.classList.remove('walk', 'back'), 650);
  }
  function progress() {
    const all = steps(), n = all.length - 1, i = Math.min(S.i, n);
    const pct = n ? i / n : 0;
    tiger.style.left = `calc(${pct * 100}% * .92 + 4%)`; fill.style.width = (pct * 100) + '%';
    walk(pct);
    coins.innerHTML = all.slice(1, -1).map((_, k) => `<i class="qz-coin${k + 1 <= i - 0 && i > k + 1 ? ' got' : ''}" style="left:calc(${((k + 1) / n) * 100}% * .92 + 4%)"></i>`).join('');
  }
  const answerText = q => { const a = S.ans[q.id]; if (a == null || a === '') return ''; if (Array.isArray(a)) return a.join(', '); if (typeof a === 'object') return q.type === 'size' ? (a.w || '?') + '×' + (a.h || '?') + ' ' + (q.unit || '') + (a.unknown ? ' (не знаю — нужен замер)' : '') : q.type === 'pockets' ? (a.n ? a.n + ' шт., ' + (a.f || '') : 'без карманов') : JSON.stringify(a); return String(a); };

  // проверка здравого смысла: влезут ли карманы в стенд
  const POCKET = { 'А5': [148, 210], 'А4 вертикальный': [210, 297], 'А4 горизонтальный': [297, 210], 'А3': [297, 420] };
  function pocketWarn() {
    const s = S.ans.size || {}, p = S.ans.pockets || {}; const W = +s.w, H = +s.h, n = +p.n;
    if (!W || !H || !n || !POCKET[p.f]) return '';
    const [pw, ph] = POCKET[p.f].map(x => x + 30); // карман + поля
    const perRow = Math.floor((W - 40) / pw), rows = Math.floor((H - 120) / ph); // 120 мм — заголовок
    const fit = Math.max(0, perRow) * Math.max(0, rows);
    if (fit >= n) return '';
    const cols = Math.ceil(Math.sqrt(n * (W / H || 1))), rws = Math.ceil(n / Math.max(1, cols));
    return `В стенд ${W}×${H} мм ${n} карман(а) ${p.f} не поместятся — влезет максимум ${fit}. Нужен размер примерно от ${cols * pw + 40}×${rws * ph + 120} мм, или уменьшим карманы до А5. Менеджер поможет подобрать.`;
  }

  function draw() {
    const all = steps(); if (S.i >= all.length) S.i = all.length - 1;
    const step = all[S.i], qz = QUIZZES[S.key]; $('#qzTitle', root).textContent = (S.branch ? QUIZZES[S.branch].title : qz.title) + ' · расчёт';
    progress();
    const qCount = all.length - 2, qNo = S.i;
    let html = '', canNext = true;
    if (step.t === 'intro') {
      html = `<div class="qz-q">Сейчас зададим несколько уточняющих вопросов</div><p style="color:#5f5650;line-height:1.55">${esc(qz.intro)}</p><p style="color:#7a6f67;margin-top:10px;font-size:14px">⏱ около минуты · ${Math.max(qCount, 3)} вопросов · можно пропускать</p><span class="qz-why">▶ Зачем мы спрашиваем? Видео 20 сек</span><div id="qzWhyV"></div><div class="qz-hint" id="qzWhy" style="display:none">Чтобы менеджер не тратил ваше время на переспрашивания, а дизайнер начал работу сразу. Мы работаем с 1995 года и знаем: от ответов зависят материалы, согласования и цена. Не хотите отвечать — нажмите «позвоните мне», и мы просто перезвоним.</div>`;
    } else if (step.t === 'q') {
      const q = step.q; const a = S.ans[q.id];
      html = `<div class="qz-step">вопрос ${qNo} из ${qCount}</div><div class="qz-q">${esc(q.q)}</div>`;
      if (q.type === 'one' || q.type === 'many') {
        const opts = q.dyn ? q.dyn(S.ans) : q.opts;
        html += '<div class="qz-opts">' + opts.map(o => `<button type="button" class="qz-opt${(q.type === 'many' ? (a || []).includes(o) : a === o) ? ' on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('') + '</div>';
        if (q.type === 'one') canNext = !!a;
      } else if (q.type === 'text') {
        html += `<input class="qz-in" id="qzText" placeholder="${esc(q.ph || '')}" value="${esc(a || '')}">`;
      } else if (q.type === 'size') {
        const v = a || {};
        html += `<div class="qz-row"><input class="qz-in" id="qzW" inputmode="numeric" placeholder="ширина" value="${esc(v.w || '')}"><span>×</span><input class="qz-in" id="qzH" inputmode="numeric" placeholder="высота" value="${esc(v.h || '')}"><span>${esc(q.unit)}</span></div><label class="qz-chk"><input type="checkbox" id="qzUnk"${v.unknown ? ' checked' : ''}> Не знаю — нужен замер</label>`;
      } else if (q.type === 'pockets') {
        const v = a || {};
        html += `<div class="qz-row" style="grid-template-columns:110px 1fr"><input class="qz-in" id="qzPn" inputmode="numeric" placeholder="кол-во" value="${esc(v.n || '')}"><select class="qz-in" id="qzPf">${['', 'А5', 'А4 вертикальный', 'А4 горизонтальный', 'А3', 'Индивидуальный'].map(f => `<option${f === v.f ? ' selected' : ''}>${f}</option>`).join('')}</select></div><label class="qz-chk"><input type="checkbox" id="qzNoP"${v.none ? ' checked' : ''}> Карманы не нужны</label><div id="qzPW"></div>`;
      } else if (q.type === 'info') {
        html += `<div class="qz-hint" style="font-size:15px;color:#2B2A28">${esc(q.text)}</div>`;
      }
      if (q.hint) html += `<div class="qz-hint">💡 ${esc(q.hint)}</div>`;
    } else {
      html = `<div class="qz-step">последний шаг</div><div class="qz-q">Куда прислать расчёт?</div>
        <input class="qz-in" id="qzName" placeholder="Имя" value="${esc(S.name || '')}" style="margin-bottom:8px">
        <input class="qz-in" id="qzPhone" inputmode="tel" placeholder="+7 (___) ___-__-__" value="${esc(S.phone || '')}">
        <div style="margin-top:12px;font-size:13px;font-weight:700;color:#7a6f67">Как удобнее связаться?</div>
        <div class="qz-opts" style="grid-template-columns:repeat(2,1fr);margin-top:6px">${['Позвонить', 'MAX', 'ВКонтакте', 'Не важно'].map(o => `<button type="button" class="qz-opt${S.contact === o ? ' on' : ''}" data-c="${o}" style="min-height:42px;text-align:center">${o}</button>`).join('')}</div>
        <label class="qz-chk qz-pd"><input type="checkbox" id="qzPd"${S.pd ? ' checked' : ''}><span>Даю <a href="soglasie.html" target="_blank">согласие на обработку персональных данных</a> и принимаю <a href="privacy.html" target="_blank">Политику обработки ПДн</a></span></label>`;
    }
    body.innerHTML = html;
    const isLast = step.t === 'contact';
    foot.innerHTML = (S.i > 0 ? '<button type="button" class="qz-btn qz-back">← Назад</button>' : '') +
      `<button type="button" class="qz-btn qz-next"${canNext ? '' : ' disabled'}>${step.t === 'intro' ? 'Начать →' : isLast ? 'Отправить менеджеру' : step.t === 'q' && step.q.type !== 'one' && step.t !== 'info' ? 'Дальше →' : 'Дальше →'}</button>` +
      '<button type="button" class="qz-call">📞 Устал(а) от вопросов — просто позвоните мне</button>';
    wire(step);
  }

  function wire(step) {
    $('.qz-why', body)?.addEventListener('click', () => {
      const w = $('#qzWhy'), v = $('#qzWhyV'); w.style.display = 'block';
      const run = () => { if (window.RiksWhyVideo && v && !v.firstChild) { window.RiksWhyVideo(v, { tiger: ARCH, onStart: () => go(1) }); const p = v.querySelector('.wv-play'); if (p) p.click(); } };
      if (window.RiksWhyVideo) run(); else { const sc = document.createElement('script'); sc.src = 'assets/why-video.js'; sc.onload = run; document.head.appendChild(sc); }
    });
    const next = $('.qz-next', foot);
    if (step.t === 'q') {
      const q = step.q;
      $$('.qz-opt', body).forEach(b => b.onclick = () => {
        if (q.type === 'many') { const arr = S.ans[q.id] || []; const v = b.dataset.v; S.ans[q.id] = arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v); b.classList.toggle('on'); return; }
        S.ans[q.id] = b.dataset.v; if (q.branch) S.branch = q.branch[b.dataset.v] || null;
        $$('.qz-opt', body).forEach(x => x.classList.toggle('on', x === b)); next.disabled = false;
        setTimeout(() => go(1), 220); // одиночный выбор — сразу дальше, как в игре
      });
      const t = $('#qzText', body); if (t) { t.oninput = () => S.ans[q.id] = t.value.trim(); setTimeout(() => t.focus(), 50); t.onkeydown = e => { if (e.key === 'Enter') go(1); }; }
      if (q.type === 'size') { const upd = () => S.ans[q.id] = { w: $('#qzW').value.replace(/\D/g, ''), h: $('#qzH').value.replace(/\D/g, ''), unknown: $('#qzUnk').checked }; $$('#qzW,#qzH,#qzUnk', body).forEach(i => i.oninput = i.onchange = upd); }
      if (q.type === 'pockets') { const pw = $('#qzPW'); const upd = () => { S.ans[q.id] = { n: $('#qzPn').value.replace(/\D/g, ''), f: $('#qzPf').value, none: $('#qzNoP').checked }; if (S.ans[q.id].none) S.ans[q.id] = { none: true }; const w = pocketWarn(); pw.innerHTML = w ? '<div class="qz-warn">⚠️ ' + esc(w) + '</div>' : ''; S.warn = w; }; $$('#qzPn,#qzPf,#qzNoP', body).forEach(i => i.oninput = i.onchange = upd); upd(); }
    }
    if (step.t === 'contact') {
      const ph = $('#qzPhone', body); ph.addEventListener('input', () => fmtPhone(ph));
      $$('[data-c]', body).forEach(b => b.onclick = () => { S.contact = b.dataset.c; $$('[data-c]', body).forEach(x => x.classList.toggle('on', x === b)); });
    }
    next.onclick = () => step.t === 'contact' ? submit(false) : go(1);
    $('.qz-back', foot)?.addEventListener('click', () => go(-1));
    $('.qz-call', foot).onclick = () => callMe();
  }
  function go(d) { S.i = Math.max(0, S.i + d); draw(); }

  function fmtPhone(ph) {
    let v = ph.value.replace(/\D/g, ''); if (v.startsWith('8')) v = '7' + v.slice(1); if (v && !v.startsWith('7')) v = '7' + v; v = v.slice(0, 11);
    const m = v.match(/^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/); if (!m) { ph.value = v ? '+' + v : ''; return; }
    ph.value = '+7' + (m[1] ? ' (' + m[1] : '') + (m[1].length === 3 ? ') ' : '') + m[2] + (m[3] ? '-' + m[3] : '') + (m[4] ? '-' + m[4] : '');
  }

  function collect() {
    const list = [];
    const qs = QUIZZES[S.key].qs.concat(S.key === 'general' && S.branch ? QUIZZES[S.branch].qs : []);
    qs.forEach(q => { if (q.type === 'info') return; const t = answerText(q); if (t) list.push({ q: q.q, a: t }); });
    return list;
  }
  function callMe() {
    // если телефона ещё нет — просим только его
    const ph = $('#qzPhone', body);
    const phone = (ph ? ph.value : S.phone) || '';
    if (phone.replace(/\D/g, '').length < 11) {
      body.innerHTML = '<div class="qz-q">Конечно! Оставьте номер — перезвоним.</div><input class="qz-in" id="qzPhone" inputmode="tel" placeholder="+7 (___) ___-__-__"><input class="qz-in" id="qzName" placeholder="Имя (необязательно)" style="margin-top:8px">' + `<label class="qz-chk qz-pd"><input type="checkbox" id="qzPd"${S.pd ? ' checked' : ''}><span>Даю <a href="soglasie.html" target="_blank">согласие на обработку персональных данных</a> и принимаю <a href="privacy.html" target="_blank">Политику обработки ПДн</a></span></label>`;
      foot.innerHTML = '<button type="button" class="qz-btn qz-next">Перезвоните мне</button>';
      const p = $('#qzPhone', body); p.addEventListener('input', () => fmtPhone(p)); p.focus();
      $('.qz-next', foot).onclick = () => submit(true);
      return;
    }
    submit(true);
  }
  async function submit(callback) {
    const ph = $('#qzPhone', body), nm = $('#qzName', body);
    if (ph) S.phone = ph.value; if (nm) S.name = nm.value.trim();
    if ((S.phone || '').replace(/\D/g, '').length < 11) { if (ph) { ph.style.borderColor = '#E3241B'; ph.focus(); } return; }
    const pdEl = $('#qzPd', body); if (pdEl) S.pd = pdEl.checked;
    if (!S.pd) { const l = $('.qz-pd', body); if (l) { l.classList.add('bad'); l.scrollIntoView({ block: 'nearest' }); } return; }
    const answers = collect(); const title = S.branch ? QUIZZES[S.branch].title : QUIZZES[S.key].title;
    const detail = (callback ? '📞 Просит перезвонить. ' : '') + 'Квиз «' + title + '»' + (answers.length ? ': ' + answers.map(x => x.q + ' — ' + x.a).join('; ') : ' (без ответов)') + (S.warn ? ' ⚠ ' + S.warn : '') + (S.extraDetail ? ' | ' + S.extraDetail : '');
    const extra = { name: S.name || '', phone: S.phone, service: S.service || title, detail, quiz: answers, contact: S.contact || '', callback, consent: { pd: true, ver: (window.RiksLegal && window.RiksLegal.ver) || '', at: new Date().toISOString(), page: location.pathname } };
    body.innerHTML = '<div class="qz-done"><div class="qz-arch">' + ARCH.replace(/qzFl/g, 'qzFl2') + '</div><h3>' + (callback ? 'Перезвоним!' : 'Финиш! Заявка у менеджера') + '</h3><p>' + (callback ? 'Менеджер свяжется с вами в рабочее время.' : 'Менеджер посмотрит ответы и свяжется с вами' + (S.contact && S.contact !== 'Не важно' ? ' — ' + esc(S.contact) : '') + '.') + '</p></div>';
    foot.innerHTML = '<button type="button" class="qz-btn qz-next">Отлично</button>'; $('.qz-next', foot).onclick = close;
    walk(1); tiger.style.left = '96%'; fill.style.width = '100%'; $$('.qz-coin', coins).forEach(c => c.classList.add('got'));
    if (S.onDone) S.onDone(extra);
    else {
      const SRC = window.RiksSRC || {}; const lbl = window.RiksSrcLabel ? window.RiksSrcLabel() : 'сайт';
      try { await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(extra, { page: location.pathname.replace(/^\//, '') || 'index.html', source: lbl, utm: SRC.utm || {}, ref: SRC.ref || '', ts: new Date().toISOString() })) }); } catch (e) {}
    }
    S.sent = true;
  }
  function close() { root.classList.remove('on'); document.documentElement.style.overflow = ''; }
  $('.qz-x', root).onclick = () => { if (!S || S.sent || S.i === 0 || confirm('Закрыть? Ответы не сохранятся.')) close(); };
  root.addEventListener('click', e => { if (e.target === root) $('.qz-x', root).onclick(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('on')) $('.qz-x', root).onclick(); });

  window.RiksQuiz = {
    open(o) {
      o = o || {};
      const key = o.key || fromService(o.service) || pageKey();
      lastPct = 0;
      S = { key: QUIZZES[key] ? key : 'general', i: o.skipIntro ? 1 : 0, ans: {}, name: o.name || '', phone: o.phone || '', service: o.service || '', onDone: o.onDone, branch: null, contact: '', extraDetail: o.detail || '', pd: !!o.pd };
      root.classList.add('on'); document.documentElement.style.overflow = 'hidden'; draw();
    },
    QUIZZES
  };

  // кнопки и ссылки, которые открывают квиз
  document.addEventListener('click', e => {
    // только ссылки и кнопки: data-quiz на <body> задаёт набор вопросов страницы и кликом не считается
    const el = e.target.closest('a[data-quiz], button[data-quiz], a[href="#lead"], a[href="#form"]');
    if (!el || el.closest('.qz')) return;
    e.preventDefault();
    window.RiksQuiz.open({ key: el.dataset.quiz || '' });
  });
})();
