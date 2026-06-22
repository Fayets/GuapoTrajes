export type TallerConfig = {
  apiPrefix: string;
  idQueryParam: string;
  productRelationKey: "lavanderia" | "modista";
  remitoPrefix: string;
  colaKeyPrefix: string;
  labels: {
    title: string;
    subtitle: string;
    entitySingular: string;
    entityPlural: string;
    newEntity: string;
    searchPlaceholder: string;
    emptyList: string;
    remitoTitle: string;
    remitoEntityLabel: string;
    selectEntity: string;
    selectEntityHint: string;
    noProducts: string;
    editEntity: string;
    createEntity: string;
    modalDescription: string;
    chooseEntityError: string;
  };
};

export const LAVANDERIA_CONFIG: TallerConfig = {
  apiPrefix: "/lavanderia",
  idQueryParam: "lavanderia_id",
  productRelationKey: "lavanderia",
  remitoPrefix: "REM-REC-LAV",
  colaKeyPrefix: "etq",
  labels: {
    title: "Lavandería",
    subtitle: "Gestión de lavanderías de Guapo Trajes.",
    entitySingular: "lavandería",
    entityPlural: "lavanderías",
    newEntity: "Nueva lavandería",
    searchPlaceholder: "Buscar lavanderías...",
    emptyList: "No se encontraron lavanderías.",
    remitoTitle: "Recepción desde lavandería",
    remitoEntityLabel: "Lavandería",
    selectEntity: "Lavandería",
    selectEntityHint: "Seleccioná una lavandería para ver las prendas que están allá.",
    noProducts: "No hay prendas en esta lavandería en este momento.",
    editEntity: "Editar lavandería",
    createEntity: "Nueva lavandería",
    modalDescription: "Completá los datos de la lavandería asociada.",
    chooseEntityError: "Elegí una lavandería",
  },
};

export const MODISTA_CONFIG: TallerConfig = {
  apiPrefix: "/modistas",
  idQueryParam: "modista_id",
  productRelationKey: "modista",
  remitoPrefix: "REM-REC-MOD",
  colaKeyPrefix: "etq-mod",
  labels: {
    title: "Modista",
    subtitle: "Gestión de modistas de Guapo Trajes.",
    entitySingular: "modista",
    entityPlural: "modistas",
    newEntity: "Nueva modista",
    searchPlaceholder: "Buscar modistas...",
    emptyList: "No se encontraron modistas.",
    remitoTitle: "Recepción desde modista",
    remitoEntityLabel: "Modista",
    selectEntity: "Modista",
    selectEntityHint: "Seleccioná una modista para ver las prendas que están allá.",
    noProducts: "No hay prendas en esta modista en este momento.",
    editEntity: "Editar modista",
    createEntity: "Nueva modista",
    modalDescription: "Completá los datos de la modista asociada.",
    chooseEntityError: "Elegí una modista",
  },
};
