import { Side } from "./math/Side";
import { Vector2D } from "./math/Vector2";
import { difference, union } from "../api/ops-booleans";
import { Vertex2D } from "./math/Vertex2";
import { CAG } from "./CAG";
import { isSelfIntersecting, contains } from "./utils/cagValidation";
import { areaEPS } from "./constants";

/** Construct a CAG from a list of `Side` instances.
 * @param {Side[]} sides - list of sides
 * @returns {CAG} new CAG object
 */
export function fromSides(sides)
{
    let cag = new CAG();
    cag.sides = sides;
    return cag;
}

// Converts a CSG to a  The CSG must consist of polygons with only z coordinates +1 and -1
// as constructed by _toCSGWall(-1, 1). This is so we can use the 3D union(), intersect() etc
export function fromFakeCSG(csg)
{
    let sides = csg.polygons
        .map(p =>
        {
            return Side._fromFakePolygon(p);
        })
        .filter(s =>
        {
            return s !== null;
        });
    return fromSides(sides);
}

/** Construct a CAG from a list of points (a polygon) or an nested array of points.
 * The rotation direction of the points is not relevant.
 * The points can define a convex or a concave polygon.
 * The polygon must not self intersect.
 * Hole detection follows the even/odd rule,
 * which means that the order of the paths is not important.
 * @param {points[]|Array.<points[]>} points - (nested) list of points in 2D space
 * @returns {CAG} new CAG object
 */
export function fromPoints(points)
{
    if (!points)
    {
        throw new Error("points parameter must be defined");
    }
    if (!Array.isArray(points))
    {
        throw new Error("points parameter must be an array");
    }
    if (points[0].x !== undefined || typeof points[0][0] === "number")
    {
        return fromPointsArray(points);
    }
    if (typeof points[0][0] === "object")
    {
        return fromNestedPointsArray(points);
    }
    throw new Error("Unsupported points list format");
}

// Do not export the two following function (code splitting for fromPoints())
export function fromPointsArray(points)
{
    if (points.length < 3)
    {
        throw new Error("CAG shape needs at least 3 points");
    }
    let sides = [];
    let prevvertex = new Vertex2D(new Vector2D(points[points.length - 1]));
    points.map(point =>
    {
        let vertex = new Vertex2D(new Vector2D(point));
        sides.push(new Side(prevvertex, vertex));
        prevvertex = vertex;
    });
    let result = fromSides(sides);
    if (isSelfIntersecting(result))
    {
        throw new Error("Polygon is self intersecting!");
    }
    let area = result.area;
    if (Math.abs(area) < areaEPS)
    {
        throw new Error("Degenerate polygon!");
    }
    if (area < 0)
    {
        result = result.flipped();
    }
    return result.canonicalized();
}

export function fromNestedPointsArray(points)
{
    if (points.length === 1)
    {
        return fromPoints(points[0]);
    }
    // First pass: create a collection of CAG paths
    let paths = [];
    points.forEach(path =>
    {
        paths.push(fromPointsArray(path));
    });
    // Second pass: make a tree of paths
    let tree = {};
    // for each polygon extract parents and childs polygons
    paths.forEach((p1, i) =>
    {
        // check for intersection
        paths.forEach((p2, y) =>
        {
            if (p1 !== p2)
            {
                // create default node
                tree[i] || (tree[i] = { parents: [], isHole: false });
                tree[y] || (tree[y] = { parents: [], isHole: false });
                // check if polygon2 stay in poylgon1
                if (contains(p2, p1))
                {
                    // push parent and child; odd parents number ==> hole
                    tree[i].parents.push(y);
                    tree[i].isHole = !!(tree[i].parents.length % 2);
                    tree[y].isHole = !!(tree[y].parents.length % 2);
                }
            }
        });
    });
    // Third pass: subtract holes
    let path = null;
    for (let key in tree)
    {
        path = tree[key];
        if (path.isHole)
        {
            delete tree[key]; // remove holes for final pass
            path.parents.forEach(parentKey =>
            {
                paths[parentKey] = difference(paths[parentKey], paths[key]);
            });
        }
    }
    // Fourth and last pass: create final CAG object
    let cag = fromSides([]);
    for (let key in tree)
    {
        cag = union(cag, paths[key]);
    }
    return cag;
}

/** Reconstruct a CAG from an object with identical property names.
 * @param {Object} obj - anonymous object, typically from JSON
 * @returns {CAG} new CAG object
 */
export function fromObject(obj)
{
    let sides = obj.sides.map(s =>
    {
        return Side.fromObject(s);
    });
    let cag = fromSides(sides);
    cag.isCanonicalized = obj.isCanonicalized;
    return cag;
}

/** Construct a CAG from a list of points (a polygon).
 * Like fromPoints() but does not check if the result is a valid polygon.
 * The points MUST rotate counter clockwise.
 * The points can define a convex or a concave polygon.
 * The polygon must not self intersect.
 * @param {points[]} points - list of points in 2D space
 * @returns {CAG} new CAG object
 */
export function fromPointsNoCheck(points)
{
    let sides = [];
    let prevpoint = new Vector2D(points[points.length - 1]);
    let prevvertex = new Vertex2D(prevpoint);
    points.map(p =>
    {
        let point = new Vector2D(p);
        let vertex = new Vertex2D(point);
        let side = new Side(prevvertex, vertex);
        sides.push(side);
        prevvertex = vertex;
    });
    return fromSides(sides);
}

/** Construct a CAG from a 2d-path (a closed sequence of points).
 * Like fromPoints() but does not check if the result is a valid polygon.
 * @param {path} Path2 - a Path2 path
 * @returns {CAG} new CAG object
 */
export function fromPath2(path)
{
    if (!path.isClosed()) throw new Error("The path should be closed!");
    return fromPoints(path.getPoints());
}

/** Reconstruct a CAG from the output of toCompactBinary().
 * @param {CompactBinary} bin - see toCompactBinary()
 * @returns {CAG} new CAG object
 */
export function fromCompactBinary(bin)
{
    if (bin["class"] !== "CAG") throw new Error("Not a CAG");
    let vertices = [];
    let vertexData = bin.vertexData;
    let numvertices = vertexData.length / 2;
    let arrayindex = 0;
    for (let vertexindex = 0; vertexindex < numvertices; vertexindex++)
    {
        let x = vertexData[arrayindex++];
        let y = vertexData[arrayindex++];
        let pos = new Vector2D(x, y);
        let vertex = new Vertex2D(pos);
        vertices.push(vertex);
    }
    let sides = [];
    let numsides = bin.sideVertexIndices.length / 2;
    arrayindex = 0;
    for (let sideindex = 0; sideindex < numsides; sideindex++)
    {
        let vertexindex0 = bin.sideVertexIndices[arrayindex++];
        let vertexindex1 = bin.sideVertexIndices[arrayindex++];
        let side = new Side(vertices[vertexindex0], vertices[vertexindex1]);
        sides.push(side);
    }
    let cag = fromSides(sides);
    cag.isCanonicalized = true;
    return cag;
}