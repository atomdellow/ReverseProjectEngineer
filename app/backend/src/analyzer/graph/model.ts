import { Component, Module, Artifact, Relation } from '../../core/types';

export interface GraphModel {
  components: Component[];
  modules: Module[];
  artifacts: Artifact[];
  relations: Relation[];
}

export interface GraphNode {
  id: string;
  type: 'component' | 'module' | 'artifact';
  name: string;
  path: string;
  size: number;
  depth: number;
  tags: string[];
  x?: number;
  y?: number;
  weight?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'invokes' | 'owns' | 'tests' | 'configOf' | 'blocks' | 'depends';
  strength: number;
  weight?: number;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  maxDepth: number;
  avgDepth: number;
  componentCentrality: Record<string, number>;
  clusteringCoefficient: number;
}

export class GraphModel {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();

  constructor(
    components: Component[] = [],
    modules: Module[] = [],
    artifacts: Artifact[] = [],
    relations: Relation[] = []
  ) {
    this.buildGraph(components, modules, artifacts, relations);
  }

  private buildGraph(
    components: Component[],
    modules: Module[],
    artifacts: Artifact[],
    relations: Relation[]
  ): void {
    // Add component nodes
    components.forEach(component => {
      this.addNode({
        id: component.id,
        type: 'component',
        name: component.name,
        path: component.path,
        size: component.artifacts.length,
        depth: this.calculateDepth(component.path),
        tags: component.tags,
        weight: component.commitCount
      });
    });

    // Add module nodes
    modules.forEach(module => {
      this.addNode({
        id: module.id,
        type: 'module',
        name: module.name,
        path: module.path,
        size: module.artifacts.length,
        depth: this.calculateDepth(module.path),
        tags: module.tags,
        weight: module.commitCount
      });
    });

    // Add artifact nodes
    artifacts.forEach(artifact => {
      this.addNode({
        id: artifact.id,
        type: 'artifact',
        name: artifact.name,
        path: artifact.path,
        size: artifact.size,
        depth: this.calculateDepth(artifact.path),
        tags: [artifact.language, artifact.role],
        weight: artifact.commitCount
      });
    });

    // Add edges from relations
    relations.forEach(relation => {
      this.addEdge({
        id: `${relation.sourceId}-${relation.targetId}-${relation.type}`,
        source: relation.sourceId,
        target: relation.targetId,
        type: relation.type,
        strength: relation.strength,
        weight: relation.strength
      });
    });
  }

  private calculateDepth(path: string): number {
    return path.split('/').length - 1;
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    
    // Update adjacency list
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    if (!this.adjacencyList.has(edge.target)) {
      this.adjacencyList.set(edge.target, new Set());
    }
    
    this.adjacencyList.get(edge.source)!.add(edge.target);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  getNodesByType(type: 'component' | 'module' | 'artifact'): GraphNode[] {
    return this.getAllNodes().filter(node => node.type === type);
  }

  getNeighbors(nodeId: string): GraphNode[] {
    const neighborIds = this.adjacencyList.get(nodeId);
    if (!neighborIds) return [];
    
    return Array.from(neighborIds)
      .map(id => this.getNode(id))
      .filter(node => node !== undefined) as GraphNode[];
  }

  getEdgesForNode(nodeId: string): GraphEdge[] {
    return this.getAllEdges().filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );
  }

  getDependencies(nodeId: string): GraphNode[] {
    const dependencies: GraphNode[] = [];
    const dependencyEdges = this.getAllEdges().filter(
      edge => edge.target === nodeId && 
      ['imports', 'depends', 'blocks'].includes(edge.type)
    );
    
    dependencyEdges.forEach(edge => {
      const sourceNode = this.getNode(edge.source);
      if (sourceNode) {
        dependencies.push(sourceNode);
      }
    });
    
    return dependencies;
  }

  getDependents(nodeId: string): GraphNode[] {
    const dependents: GraphNode[] = [];
    const dependentEdges = this.getAllEdges().filter(
      edge => edge.source === nodeId && 
      ['imports', 'depends', 'blocks'].includes(edge.type)
    );
    
    dependentEdges.forEach(edge => {
      const targetNode = this.getNode(edge.target);
      if (targetNode) {
        dependents.push(targetNode);
      }
    });
    
    return dependents;
  }

  calculateMetrics(): GraphMetrics {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    // Calculate density
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // Calculate depth metrics
    const depths = nodes.map(node => node.depth);
    const maxDepth = Math.max(...depths, 0);
    const avgDepth = depths.length > 0 ? depths.reduce((sum, d) => sum + d, 0) / depths.length : 0;

    // Calculate component centrality (degree centrality)
    const componentCentrality: Record<string, number> = {};
    nodes.forEach(node => {
      const degree = this.getEdgesForNode(node.id).length;
      componentCentrality[node.id] = nodeCount > 1 ? degree / (nodeCount - 1) : 0;
    });

    // Calculate clustering coefficient
    let clusteringCoefficient = 0;
    if (nodeCount > 2) {
      let totalCoefficient = 0;
      nodes.forEach(node => {
        const neighbors = this.getNeighbors(node.id);
        if (neighbors.length > 1) {
          let edgesBetweenNeighbors = 0;
          for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
              const edge = this.getAllEdges().find(
                e => (e.source === neighbors[i].id && e.target === neighbors[j].id) ||
                     (e.source === neighbors[j].id && e.target === neighbors[i].id)
              );
              if (edge) edgesBetweenNeighbors++;
            }
          }
          const maxPossible = (neighbors.length * (neighbors.length - 1)) / 2;
          totalCoefficient += maxPossible > 0 ? edgesBetweenNeighbors / maxPossible : 0;
        }
      });
      clusteringCoefficient = totalCoefficient / nodeCount;
    }

    return {
      nodeCount,
      edgeCount,
      density,
      maxDepth,
      avgDepth,
      componentCentrality,
      clusteringCoefficient
    };
  }

  findShortestPath(sourceId: string, targetId: string): GraphNode[] | null {
    if (sourceId === targetId) {
      const node = this.getNode(sourceId);
      return node ? [node] : null;
    }

    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: sourceId, path: [sourceId] }];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);
      
      if (current.nodeId === targetId) {
        return current.path.map(id => this.getNode(id)).filter(node => node !== undefined) as GraphNode[];
      }
      
      const neighbors = this.getNeighbors(current.nodeId);
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor.id)) {
          queue.push({
            nodeId: neighbor.id,
            path: [...current.path, neighbor.id]
          });
        }
      });
    }
    
    return null; // No path found
  }

  findCycles(): GraphNode[][] {
    const cycles: GraphNode[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const neighbors = this.getNeighbors(nodeId);
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor.id)) {
          dfs(neighbor.id, [...path, neighbor.id]);
        } else if (recursionStack.has(neighbor.id)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor.id);
          if (cycleStart >= 0) {
            const cyclePath = path.slice(cycleStart);
            const cycleNodes = cyclePath.map(id => this.getNode(id)).filter(node => node !== undefined) as GraphNode[];
            if (cycleNodes.length > 2) {
              cycles.push(cycleNodes);
            }
          }
        }
      });
      
      recursionStack.delete(nodeId);
    };
    
    this.getAllNodes().forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id, [node.id]);
      }
    });
    
    return cycles;
  }

  getSubgraph(nodeIds: string[]): GraphModel {
    const subgraphNodes = nodeIds.map(id => this.getNode(id)).filter(node => node !== undefined) as GraphNode[];
    const subgraphEdges = this.getAllEdges().filter(
      edge => nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );
    
    const subgraph = new GraphModel();
    subgraphNodes.forEach(node => subgraph.addNode(node));
    subgraphEdges.forEach(edge => subgraph.addEdge(edge));
    
    return subgraph;
  }

  exportForVisualization(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    };
  }
}