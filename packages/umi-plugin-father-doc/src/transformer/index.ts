import path from 'upath';
import getYamlConfig from 'umi-build-dev/lib/routes/getYamlConfig';
import remark from './remark';

const FRONT_COMMENT_EXP = /^\n*\/\*[^]+?\s*\*\/\n*/;
const MD_WRAPPER = `
import React from 'react';
import Alert from '${path.join(__dirname, '../themes/default/alert.js')}';
import FatherDocPreviewer from '${path.join(__dirname, '../themes/default/previewer.js')}';

export default function () {
  return <>$CONTENT</>;
}`

interface HeadingItem {
  type: string,
  depth: number,
  [key: string]: any;
}

export interface TransformResult {
  content: string;
  config: {
    frontmatter: { [key: string]: any };
    headingData?: HeadingItem[];
    [key: string]: any;
  };
}

function notNull(x) {
  return x !== null;
}

function getMarkdownHeaders(lines, maxHeaderLevel) {
  function extractText(header) {
    return header.children
      .map(function (x) {
        if (x.type === 'text') {
          return x.value;
        } else {
          return '*';
        }
      })
      .join('');
  }
  return lines
    .map(function (x) {
      return !maxHeaderLevel || x.depth <= maxHeaderLevel
        ? { rank: x.depth, name: extractText(x) }
        : null;
    }).filter(notNull);
}
const parseRoutes = (routes = []) => {
  const routesObject = {};
  let rootNode = null;
  let rootIndex = 0;
  for (let i = 0; i < routes.length; i++) {
    const item = routes[i];
    if (rootNode === null) {
      rootNode = item;
      rootIndex = i;
    } else if (item.rank <= rootNode.rank) {
      const subRoutes = routes.slice(rootIndex + 1, i);
      routesObject[rootNode.name] = parseRoutes(subRoutes);
      rootNode = item;
      rootIndex = i;
    }
  }
  if (rootIndex === routes.length - 1) {
    routesObject[rootNode.name] = {};
  } else if (rootNode) {
    const restRoutes = routes.slice(rootIndex + 1, routes.length);
    routesObject[rootNode.name] = parseRoutes(restRoutes);
  } else {
  }
  return routesObject;
};

export default {
  markdown(raw: string, dir: string): TransformResult {
    const result = remark(raw, dir);
    const contents = (result.contents as string).replace(/class="/g, 'className="');
    const subLayoutData = parseRoutes(getMarkdownHeaders((result.data as TransformResult['config']).headingData, 3));
    return {
      content: MD_WRAPPER.replace('$CONTENT', contents),
      config: {
        frontmatter: {},
        ...result.data as TransformResult['config'],
        subLayoutData
      },
    };
  },
  jsx(raw: string): TransformResult {
    return {
      // discard frontmatter for source code display
      content: raw.replace(FRONT_COMMENT_EXP, ''),
      config: {
        frontmatter: getYamlConfig(raw),
      },
    };
  },
  tsx(raw: string): TransformResult {
    return this.jsx(raw);
  },
}
