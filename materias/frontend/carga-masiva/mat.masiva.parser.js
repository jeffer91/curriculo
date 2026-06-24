/*
Nombre del archivo: mat.masiva.parser.js
Ubicación: C:\Users\ITSQMET\Desktop\desarrollo\Curriculo\materias\frontend\carga-masiva\mat.masiva.parser.js
Función:
- Analiza texto pegado en la carga masiva
- Limpia encabezados basura y ruido institucional
- Detecta niveles como "Nivel 1" y "1 Nivel"
- Limpia filas copiadas desde tablas como "1 Administración I"
- Devuelve una vista previa consistente para materias, transversales, núcleos y ejes
*/
(function (window) {
"use strict";

window.MAT = window.MAT || {};
var MAT = window.MAT;

MAT.masiva = MAT.masiva || {};
MAT.masiva.parser = MAT.masiva.parser || {};

var EXACT_NOISE = {
    "malla curricular": true,
    "asignatura": true,
    "asignaturas": true,
    "n asignatura": true,
    "n asignaturas": true,
    "no asignatura": true,
    "no asignaturas": true,
    "nro asignatura": true,
    "nro asignaturas": true,
    "numero asignatura": true,
    "numero asignaturas": true,
    "materia": true,
    "materias": true
};

var NOISE_PATTERNS = [
    /^instituci[oó]n\s*:/i,
    /^nombre\s+completo\s+visible\s*:/i,
    /^nombre\s+visible\s*:/i,
    /^malla\s+curricular\b/i,
    /^listado\s+de\s+asignaturas\b/i,
    /^plan\s+de\s+estudios\b/i,
    /^pensum\b/i
];

function stripAccents(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(text) {
    return String(text || "")
        .replace(/\u00A0/g, " ")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeComparable(text) {
    return stripAccents(normalizeWhitespace(text))
        .replace(/[º°]/g, "")
        .replace(/[|]/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function splitRawLines(raw) {
    return String(raw || "")
        .split(/\r?\n/)
        .map(function (line) {
            return normalizeWhitespace(line);
        })
        .filter(function (line) {
            return !!line;
        });
}

function cloneDeep(value) {
    try {
        return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
        return value || null;
    }
}

function toArray(value) {
    return Array.isArray(value) ? value.slice() : [];
}

function createLevelSummary() {
    return {
        nivel1: [],
        nivel2: [],
        nivel3: [],
        nivel4: [],
        sinNivel: []
    };
}

function mapLevelToken(token) {
    var key = normalizeComparable(token);

    if (key === "1" || key === "i" || key === "primer" || key === "primero" || key === "1er") {
        return "1";
    }
    if (key === "2" || key === "ii" || key === "segundo" || key === "2do") {
        return "2";
    }
    if (key === "3" || key === "iii" || key === "tercero" || key === "3er") {
        return "3";
    }
    if (key === "4" || key === "iv" || key === "cuarto" || key === "4to") {
        return "4";
    }

    return "";
}

function stripBulletPrefix(text) {
    return normalizeWhitespace(String(text || "").replace(/^[\-\*\•\·\▪\▫\‣\–\—]+\s*/, ""));
}

function stripSimpleListPrefix(text) {
    return stripBulletPrefix(text)
        .replace(/^\(?\d{1,2}\)?\s*[\.\-\)]\s*/, "")
        .trim();
}

function stripTableRowPrefix(text) {
    var value = stripBulletPrefix(text);
    var match = value.match(/^\(?([1-9]|[12]\d|30)\)?\s*(?:[\.\-\)]\s*|\s+)(.+)$/);

    if (match && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(match[2])) {
        return normalizeWhitespace(match[2]);
    }

    return value;
}

function extractLevelHeader(text) {
    var value = stripBulletPrefix(text);
    var match = null;
    var level = "";
    var rest = "";

    match = value.match(/^(?:nivel|niv\.)\s*(1|2|3|4|i{1,3}|iv|primer|primero|segundo|tercero|cuarto|1er|2do|3er|4to)\b[\s:.\-–—|]*(.*)$/i);

    if (!match) {
        match = value.match(/^(1|2|3|4|i{1,3}|iv|primer|primero|segundo|tercero|cuarto|1er|2do|3er|4to)\s*(?:nivel|niv\.)\b[\s:.\-–—|]*(.*)$/i);
    }

    if (!match) {
        match = value.match(/^(.*?)\s*[:.\-–—|]\s*(?:nivel|niv\.)\s*(1|2|3|4|i{1,3}|iv)\s*$/i);
        if (match) {
            level = mapLevelToken(match[2]);
            rest = normalizeWhitespace(match[1]);
            return {
                level: level,
                text: rest
            };
        }
    }

    if (!match) {
        return {
            level: "",
            text: value
        };
    }

    level = mapLevelToken(match[1]);
    rest = normalizeWhitespace(match[2] || "");

    return {
        level: level,
        text: rest
    };
}

function isNoiseLine(text) {
    var value = normalizeWhitespace(text);
    var comparable = normalizeComparable(value);
    var i;

    if (!value) {
        return true;
    }

    if (EXACT_NOISE[comparable]) {
        return true;
    }

    for (i = 0; i < NOISE_PATTERNS.length; i += 1) {
        if (NOISE_PATTERNS[i].test(value)) {
            return true;
        }
    }

    return false;
}

function isSelectedCareerTitle(text, options, beforeFirstLevel) {
    var careerName = options && options.careerName ? String(options.careerName) : "";

    if (!careerName) {
        return false;
    }

    if (!beforeFirstLevel) {
        return false;
    }

    return normalizeComparable(text) === normalizeComparable(careerName);
}

function sanitizeSubjectLine(text) {
    var value = normalizeWhitespace(text);

    if (!value) {
        return "";
    }

    value = stripTableRowPrefix(value);
    value = normalizeWhitespace(value);
    value = value.replace(/^[:.\-–—|]+\s*/, "").trim();

    if (!value) {
        return "";
    }

    if (isNoiseLine(value)) {
        return "";
    }

    return value;
}

function pushDiscard(meta, line, reason) {
    meta.discarded.push({
        line: String(line || ""),
        reason: String(reason || "")
    });
}

function pushAccepted(meta, value) {
    meta.accepted.push(String(value || ""));
}

function parseLevelBasedInput(rawOrLines, options) {
    var lines = Array.isArray(rawOrLines) ? toArray(rawOrLines) : splitRawLines(rawOrLines);
    var summary = createLevelSummary();
    var meta = {
        parser: "smart-level-parser",
        accepted: [],
        discarded: [],
        warnings: [],
        hasLevelHeaders: false
    };
    var currentLevel = "";
    var i;
    var line;
    var levelInfo;
    var candidate;
    var beforeFirstLevel;

    options = options || {};

    for (i = 0; i < lines.length; i += 1) {
        line = normalizeWhitespace(lines[i]);
        beforeFirstLevel = !meta.hasLevelHeaders;

        if (!line) {
            continue;
        }

        if (isSelectedCareerTitle(line, options, beforeFirstLevel)) {
            pushDiscard(meta, line, "titulo-carrera");
            continue;
        }

        levelInfo = extractLevelHeader(line);

        if (levelInfo.level) {
            currentLevel = "nivel" + levelInfo.level;
            meta.hasLevelHeaders = true;

            if (levelInfo.text) {
                candidate = sanitizeSubjectLine(levelInfo.text);
                if (candidate) {
                    summary[currentLevel].push(candidate);
                    pushAccepted(meta, candidate);
                } else {
                    pushDiscard(meta, line, "encabezado-contenido-descartado");
                }
            }
            continue;
        }

        if (isNoiseLine(line)) {
            pushDiscard(meta, line, "encabezado-ruido");
            continue;
        }

        candidate = sanitizeSubjectLine(line);

        if (!candidate) {
            pushDiscard(meta, line, "linea-vacia-o-ruido");
            continue;
        }

        if (isSelectedCareerTitle(candidate, options, beforeFirstLevel)) {
            pushDiscard(meta, line, "titulo-carrera");
            continue;
        }

        if (currentLevel && summary[currentLevel]) {
            summary[currentLevel].push(candidate);
        } else {
            summary.sinNivel.push(candidate);
        }

        pushAccepted(meta, candidate);
    }

    if (options.loadType === "materias-carrera") {
        if (!meta.hasLevelHeaders && meta.accepted.length) {
            meta.warnings.push("No se detectaron encabezados de nivel. Los elementos quedaron en Sin nivel.");
        } else if (summary.sinNivel.length) {
            meta.warnings.push("Se detectaron elementos fuera de los niveles definidos.");
        }
    }

    return {
        summary: summary,
        meta: meta
    };
}

function parseFlatInput(rawOrLines, options) {
    var lines = Array.isArray(rawOrLines) ? toArray(rawOrLines) : splitRawLines(rawOrLines);
    var items = [];
    var meta = {
        parser: "smart-flat-parser",
        accepted: [],
        discarded: [],
        warnings: [],
        hasLevelHeaders: false
    };
    var i;
    var line;
    var levelInfo;
    var candidate;
    var beforeFirstLevel;

    options = options || {};

    for (i = 0; i < lines.length; i += 1) {
        line = normalizeWhitespace(lines[i]);
        beforeFirstLevel = !meta.hasLevelHeaders;

        if (!line) {
            continue;
        }

        if (isSelectedCareerTitle(line, options, beforeFirstLevel)) {
            pushDiscard(meta, line, "titulo-carrera");
            continue;
        }

        if (isNoiseLine(line)) {
            pushDiscard(meta, line, "encabezado-ruido");
            continue;
        }

        levelInfo = extractLevelHeader(line);

        if (levelInfo.level) {
            meta.hasLevelHeaders = true;

            if (!levelInfo.text) {
                pushDiscard(meta, line, "encabezado-nivel");
                continue;
            }

            candidate = sanitizeSubjectLine(levelInfo.text);
        } else {
            candidate = sanitizeSubjectLine(line);
        }

        if (!candidate) {
            pushDiscard(meta, line, "linea-vacia-o-ruido");
            continue;
        }

        if (isSelectedCareerTitle(candidate, options, beforeFirstLevel)) {
            pushDiscard(meta, line, "titulo-carrera");
            continue;
        }

        items.push(candidate);
        pushAccepted(meta, candidate);
    }

    return {
        items: items,
        meta: meta
    };
}

function buildAnalysis(kind, summary, rawLines, meta, options) {
    return {
        kind: String(kind || ""),
        totalLines: Array.isArray(rawLines) ? rawLines.length : 0,
        rawLines: Array.isArray(rawLines) ? rawLines.slice() : [],
        summary: cloneDeep(summary || {}),
        careerType: String((options && options.careerType) || ""),
        meta: cloneDeep(meta || {})
    };
}

MAT.masiva.parser.cleanLines = function (raw) {
    return splitRawLines(raw);
};

MAT.masiva.parser.stripListPrefix = function (text) {
    return stripSimpleListPrefix(text);
};

MAT.masiva.parser.extractLevelLine = function (text) {
    return extractLevelHeader(text);
};

MAT.masiva.parser.parseMateriasCarrera = function (rawOrLines, options) {
    var parsed = parseLevelBasedInput(rawOrLines, options);

    return buildAnalysis(
        "materias-carrera",
        parsed.summary,
        parsed.meta.accepted,
        parsed.meta,
        options
    );
};

MAT.masiva.parser.parseTransversales = function (rawOrLines, options) {
    var parsed = parseLevelBasedInput(rawOrLines, options);

    return buildAnalysis(
        "transversales",
        parsed.summary,
        parsed.meta.accepted,
        parsed.meta,
        options
    );
};

MAT.masiva.parser.parseFlatList = function (rawOrLines, kind, expected, options) {
    var parsed = parseFlatInput(rawOrLines, options);
    var summary = {
        expected: Number(expected || 0),
        total: parsed.items.length,
        items: parsed.items.slice()
    };

    return buildAnalysis(
        kind,
        summary,
        parsed.meta.accepted,
        parsed.meta,
        options
    );
};

MAT.masiva.parser.analyze = function (raw, options) {
    var opts = options && typeof options === "object" ? cloneDeep(options) : {};
    var loadType = String(opts.loadType || "").trim();
    var expected = Number(opts.expected || 0);
    var basicLines;

    if (loadType === "materias-carrera") {
        return MAT.masiva.parser.parseMateriasCarrera(raw, opts);
    }

    if (loadType === "transversales") {
        return MAT.masiva.parser.parseTransversales(raw, opts);
    }

    if (loadType === "nucleos") {
        return MAT.masiva.parser.parseFlatList(raw, "nucleos", expected || 4, opts);
    }

    if (loadType === "ejes") {
        return MAT.masiva.parser.parseFlatList(raw, "ejes", expected || 4, opts);
    }

    basicLines = splitRawLines(raw);

    return buildAnalysis(
        loadType,
        { items: basicLines.slice() },
        basicLines,
        {
            parser: "basic-fallback-parser",
            accepted: basicLines.slice(),
            discarded: [],
            warnings: []
        },
        opts
    );
};

})(window);