import type {
  CatalogItem,
  KnowledgeDocument,
  Park,
  Resource,
} from '@sophia/shared';
import type { CatalogService, KnowledgeService, ParkService } from '@sophia/domain';
import type { IResourceRepository } from '@sophia/domain';

const PARK_ID = 'park-nakhodka';

export async function seedNakhodka(deps: {
  parks: ParkService;
  knowledge: KnowledgeService;
  catalog: CatalogService;
  resources: IResourceRepository;
}): Promise<void> {
  const now = new Date().toISOString();

  const park: Park = {
    id: PARK_ID,
    slug: 'nakhodka',
    name: 'Софи Парк Находка',
    city: 'Находка',
    timezone: 'Asia/Vladivostok',
    address: 'г. Находка, Приморский край, Находкинский проспект, 36, ТЦ «Тихоокеанский», 4 этаж',
    phones: ['+7 (914) 792-80-61'],
    hours: 'Ежедневно с 10:00 до 22:00',
    isActive: true,
    isDefault: true,
    website: 'https://sofipark25.ru/',
    socials: {
      vk: 'https://vk.com/sofi_park_nhk125',
      instagram: '@sofi_park_nhk125',
      telegram: 'https://t.me/s/sofi_park_nhk125',
      max: 'https://max.ru/join/L8Y0xYh_zt0gsGVqeKecoJ4wHxwp-3kS1xVIn7zJYOw',
    },
    createdAt: now,
    updatedAt: now,
  };
  await deps.parks.upsert(park);

  const resources: Resource[] = [
    {
      id: 'res-banquet-1',
      parkId: PARK_ID,
      type: 'banquet_room',
      name: 'Банкетная комната',
      capacity: 20,
      hourlyRate: 1000,
      isActive: true,
    },
    {
      id: 'res-party-1',
      parkId: PARK_ID,
      type: 'party_room',
      name: 'PartyRoom',
      capacity: 15,
      hourlyRate: 4000,
      isActive: true,
    },
    {
      id: 'res-table-1',
      parkId: PARK_ID,
      type: 'table',
      name: 'Стол в кафе',
      capacity: 10,
      hourlyRate: 0,
      isActive: true,
    },
  ];
  for (const r of resources) await deps.resources.upsert(r);

  const catalog: CatalogItem[] = [
    {
      id: 'cat-ticket',
      parkId: PARK_ID,
      category: 'ticket',
      name: 'Входной билет',
      description: 'Безлимитная игра в парке',
      priceWeekday: 900,
      priceWeekend: 1300,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-pkg-razumny',
      parkId: PARK_ID,
      category: 'package',
      name: 'Пакет «Разумный»',
      description: 'Собери свой праздник — базовый пакет дня рождения',
      priceWeekday: 8900,
      priceWeekend: 11500,
      guestsIncluded: 6,
      durationMinutes: 150,
      features: ['Вход гостей (6 чел.)', 'Экспресс-поздравление'],
      isActive: true,
    },
    {
      id: 'cat-pkg-wow',
      parkId: PARK_ID,
      category: 'package',
      name: 'Пакет «ВАУ»',
      description: 'День рождения с программой на выбор, фото и оформлением стола',
      priceWeekday: 15900,
      priceWeekend: 18900,
      guestsIncluded: 8,
      durationMinutes: 150,
      features: [
        'Вход гостей (8 чел.)',
        'Квест или шоу на выбор из прайса',
        'Проф. фотосессия 10–15 фото',
        'Тематическое оформление стола',
        '2,5 часа банкетной комнаты + 30 мин уборка',
      ],
      isActive: true,
    },
    {
      id: 'cat-pkg-premium',
      parkId: PARK_ID,
      category: 'package',
      name: 'Пакет «Премиум»',
      description: 'Расширенный пакет дня рождения',
      priceWeekday: 22900,
      priceWeekend: 26900,
      guestsIncluded: 14,
      durationMinutes: 150,
      features: [
        'Вход гостей (14 чел.)',
        'Экспресс-поздравление',
        'Проф. фотосессия',
        'Тематическое оформление стола',
        'Подарок-сертификат имениннику',
        '2,5 часа банкетной комнаты + 30 мин уборка',
      ],
      isActive: true,
    },
    {
      id: 'cat-grad-6-7',
      parkId: PARK_ID,
      category: 'graduation',
      name: 'Выпускной 6–7 лет',
      price: 3600,
      ageMin: 6,
      ageMax: 7,
      features: [
        'Анимационное шоу',
        'Дискотека',
        'Комбо-меню',
        'Подарок',
        'Сервировка стола 4 часа',
        'Видеоролик',
        'Безлимитная игра в парке',
        'Свободный вход сопровождающим',
      ],
      isActive: true,
    },
    {
      id: 'cat-grad-7-8',
      parkId: PARK_ID,
      category: 'graduation',
      name: 'Выпускной 7–8+ лет',
      price: 3950,
      ageMin: 7,
      ageMax: 8,
      features: ['Квест', 'Дискотека', 'Еда', 'Подарки', 'Сервировка', 'Фото', 'Видеоролик'],
      isActive: true,
    },
    {
      id: 'cat-grad-9-10',
      parkId: PARK_ID,
      category: 'graduation',
      name: 'Выпускной 9–10+ лет',
      price: 4200,
      ageMin: 9,
      ageMax: 12,
      features: ['Шоу «2 дивана»', 'Дискотека', 'Комбо-еда', 'Подарки', 'Фотозона', 'Сервировка', 'Видеоролик'],
      isActive: true,
    },
    {
      id: 'cat-show-divan',
      parkId: PARK_ID,
      category: 'show',
      name: 'Шоу «Два дивана»',
      price: 4000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-show-miu',
      parkId: PARK_ID,
      category: 'show',
      name: 'Шоу Миу Миу',
      price: 4000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-show-bubbles',
      parkId: PARK_ID,
      category: 'show',
      name: 'Шоу мыльных пузырей',
      price: 4500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-show-ribbon',
      parkId: PARK_ID,
      category: 'show',
      name: 'Ленточное шоу',
      price: 4500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-show-party',
      parkId: PARK_ID,
      category: 'show',
      name: 'Шоу «Пати Герл»',
      price: 5500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-quest-razgulyay',
      parkId: PARK_ID,
      category: 'quest',
      name: 'Квест «Разгуляй»',
      price: 5000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-quest-prof',
      parkId: PARK_ID,
      category: 'quest',
      name: 'Квест «Спасти профессора»',
      price: 5000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-quest-nevermore',
      parkId: PARK_ID,
      category: 'quest',
      name: 'Испытания от школы «Невермор»',
      price: 5000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-ws-slime',
      parkId: PARK_ID,
      category: 'workshop',
      name: 'МК Слайм',
      price: 400,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-ws-epoxy',
      parkId: PARK_ID,
      category: 'workshop',
      name: 'МК Эпоксидная смола',
      price: 400,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-ws-beads',
      parkId: PARK_ID,
      category: 'workshop',
      name: 'МК Бусы',
      price: 400,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-ws-food',
      parkId: PARK_ID,
      category: 'workshop',
      name: 'МК Гастрономический (пицца/бургер)',
      price: 1000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-aqua',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Аквагрим',
      price: 300,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-glitter',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Блеск тату',
      price: 200,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-photo',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Профессиональная фотосессия',
      price: 4500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-pinata',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Пиньята',
      price: 4000,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-cake',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Вынос торта',
      price: 2500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-express',
      parkId: PARK_ID,
      category: 'extra',
      name: 'Экспресс-поздравление',
      description: 'Говорящий аниматор или ростовая кукла',
      price: 3500,
      features: [],
      isActive: true,
    },
    {
      id: 'cat-rental-banquet',
      parkId: PARK_ID,
      category: 'rental',
      name: 'Аренда банкетной комнаты',
      price: 1000,
      durationMinutes: 60,
      features: ['Стол', 'Стулья', 'Сервировка'],
      isActive: true,
    },
    {
      id: 'cat-rental-party',
      parkId: PARK_ID,
      category: 'rental',
      name: 'Аренда PartyRoom',
      priceWeekday: 2000,
      priceWeekend: 4000,
      description: '30 мин / 1 час — уточняйте формат',
      features: [],
      isActive: true,
    },
    {
      id: 'cat-babysit',
      parkId: PARK_ID,
      category: 'babysitting',
      name: 'Присмотр за детьми',
      price: 500,
      durationMinutes: 120,
      description: 'До 10 детей на одного сотрудника',
      features: [],
      isActive: true,
    },
  ];

  for (const item of catalog) await deps.catalog.upsert(item);

  const docs: Array<Omit<KnowledgeDocument, 'id' | 'version' | 'indexStatus'> & { id?: string }> = [
    {
      id: 'doc-about',
      parkId: PARK_ID,
      title: 'О Софи Парке Находка',
      tags: ['about', 'парк'],
      source: 'info.md',
      body: `Софи Парк — семейный активити-парк с кафе. Юрлицо: ООО «Софи-Парк Находка», ИНН 2508149928, ОГРН 1242500019574.
Площадь более 2000 кв. м. Главный персонаж — девочка Софи.
Адрес: г. Находка, Находкинский проспект, 36, ТЦ «Тихоокеанский», 4 этаж.
График: ежедневно 10:00–22:00. Телефон и мессенджеры: +7 (914) 792-80-61.
Сайт парка Находка: https://sofipark25.ru/
Соцсети:
- ВКонтакте: https://vk.com/sofi_park_nhk125
- Instagram: @sofi_park_nhk125
- Telegram: https://t.me/s/sofi_park_nhk125
- MAX: https://max.ru/join/L8Y0xYh_zt0gsGVqeKecoJ4wHxwp-3kS1xVIn7zJYOw
Миссия: «Софи Парк: где каждый день — праздник!»
Целевая аудитория: дети 1–12 лет и их родители.
В месяц в среднем 5000–10 000 посетителей. Более 40 сотрудников: аниматоры, менеджеры, повара, кассиры, инструкторы.
Развлечения: лабиринты и горки, творческие мастер-классы, анимационные шоу, интерактивные игровые зоны, квесты, дискотеки, аквагрим.`,
    },
    {
      id: 'doc-contacts',
      parkId: PARK_ID,
      title: 'Контакты, сайт и соцсети',
      tags: ['контакты', 'сайт', 'соцсети', 'телефон', 'ссылки'],
      source: 'info.md',
      body: `Официальный сайт Sofi Park Находка: https://sofipark25.ru/
Телефон (основные мессенджеры на этом номере): +7 (914) 792-80-61
Адрес: г. Находка, Находкинский проспект, 36, ТЦ «Тихоокеанский», 4 этаж
Режим работы: ежедневно с 10:00 до 22:00
Социальные сети:
- ВКонтакте: https://vk.com/sofi_park_nhk125
- Instagram: @sofi_park_nhk125
- Telegram: https://t.me/s/sofi_park_nhk125
- MAX: https://max.ru/join/L8Y0xYh_zt0gsGVqeKecoJ4wHxwp-3kS1xVIn7zJYOw
Если спрашивают «есть ли сайт» — да, https://sofipark25.ru/`,
    },
    {
      id: 'doc-rules',
      parkId: PARK_ID,
      title: 'Правила и что мы не делаем',
      tags: ['rules', 'правила', 'запреты'],
      source: 'info.md',
      body: `Что НЕ делаем:
- Не проводим мероприятия для возраста старше 12 лет (парк для детей 1–12). По индивидуальному согласованию возможна «Мафия» или тематические форматы.
- Не предоставляем пакетные предложения без предварительного бронирования.
- Не допускаем посетителей с животными.
- Не допускаем посетителей в наркотическом или алкогольном опьянении.
- Нельзя приносить свою еду и напитки без согласования (исключение — специальное диетическое питание по рекомендации специалиста).

Краткие правила:
Безопасность: охраняемая территория, контроль доступа, гипоаллергенные материалы.
Зоны отдыха для родителей.
Обязательная уборка после мероприятий.
Запрещено бегать по опасным зонам, ломать оборудование, нарушать правила аттракционов.
Родители отвечают за детей в свободное время, если не заказан присмотр.
Полный список правил: https://drive.google.com/file/d/1_5OQVX54sxKZCQUAj0KGwMxxNrbGwPkh/view`,
    },
    {
      id: 'doc-booking',
      parkId: PARK_ID,
      title: 'Как проходит бронирование праздника',
      tags: ['booking', 'бронирование', 'день рождения'],
      source: 'info.md',
      body: `Цикл организации мероприятия:
1. Заявка — через ассистента Софию, телефон, сайт или соцсети.
2. Консультация — подбор пакета, имя именинника, возраст, любимые герои, число гостей.
3. Бронирование — оплата, дата, время, меню, аниматоры.
Важно: в будни бронь стола при предоплате 5000₽ (сервировка и подготовка).
В выходные и праздники — пакетное предложение или почасовая аренда банкетной комнаты.
В пакеты «ВАУ» и «Премиум» входит 2,5 часа банкетной комнаты + 30 минут на уборку. Продление: 1000₽/час.
4. Подготовка — оформление, еда, ответственные сотрудники.
5. Проведение — аниматоры, ведущий, ростовые куклы, повар.
6. Завершение — фотозона, видеоролик, вынос торта по согласованию.`,
    },
    {
      id: 'doc-fun',
      parkId: PARK_ID,
      title: 'Идеи досуга для детей и что есть в парке',
      tags: ['досуг', 'идеи', 'развлечения'],
      source: 'info.md',
      body: `Как можно интересно провести время с ребёнком 1–12 лет:
- Активные игры: лабиринты, горки, свободная зона парка.
- Творчество: МК слаймы, бусы, эпоксидная смола, гастро-МК пицца/бургер.
- Шоу и квесты: мыльные пузыри, ленточное шоу, «Два дивана», квесты «Разгуляй» и «Спасти профессора».
- Праздники под ключ: пакеты Разумный / ВАУ / Премиум, выпускные для разных возрастов.
- Спокойные форматы: присмотр на 2 часа, PartyRoom для фотосессии.
В Sofi Park Находка всё это можно организовать в одном месте с кафе и зонами для родителей.`,
    },
  ];

  for (const d of docs) {
    await deps.knowledge.saveDocument(d);
  }
}

export { PARK_ID };
