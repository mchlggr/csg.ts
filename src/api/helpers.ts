import { Polygon } from "../core/math/Polygon3";
import { Vector3D } from "../core/math/Vector3";
import { Vertex3D } from "../core/math/Vertex3";

export const polygonFromPoints = points =>
{
    // EEK talk about wrapping wrappers !
    const vertices = points.map(point => new Vertex3D(Vector3D.Create(point)));
    return new Polygon(vertices);
};

// Simplified, array vector rightMultiply1x3Vector
export const rightMultiply1x3VectorToArray = (matrix, vector) =>
{
    const [v0, v1, v2] = vector;
    const v3 = 1;
    let x =
        v0 * matrix.elements[0] +
        v1 * matrix.elements[1] +
        v2 * matrix.elements[2] +
        v3 * matrix.elements[3];
    let y =
        v0 * matrix.elements[4] +
        v1 * matrix.elements[5] +
        v2 * matrix.elements[6] +
        v3 * matrix.elements[7];
    let z =
        v0 * matrix.elements[8] +
        v1 * matrix.elements[9] +
        v2 * matrix.elements[10] +
        v3 * matrix.elements[11];
    let w =
        v0 * matrix.elements[12] +
        v1 * matrix.elements[13] +
        v2 * matrix.elements[14] +
        v3 * matrix.elements[15];

    // scale such that fourth element becomes 1:
    if (w !== 1)
    {
        const invw = 1.0 / w;
        x *= invw;
        y *= invw;
        z *= invw;
    }
    return [x, y, z];
};

export function clamp(value, min, max)
{
    return Math.min(Math.max(value, min), max);
}

export const cagToPointsArray = input =>
{
    let points;
    if ("sides" in input)
    {
        // this is a cag
        points = [];
        input.sides.forEach(side =>
        {
            points.push([side.vertex0.pos.x, side.vertex0.pos.y]);
            points.push([side.vertex1.pos.x, side.vertex1.pos.y]);
        });
        // cag.sides.map(side => [side.vertex0.pos.x, side.vertex0.pos.y])
        //, side.vertex1.pos.x, side.vertex1.pos.y])
        // due to the logic of CAG.fromPoints()
        // move the first point to the last
        /* if (points.length > 0) {
          points.push(points.shift())
        } */
    } else if ("points" in input)
    {
        points = input.points.map(p => [p.x, p.y]);
    }

    return points;
};

export const degToRad = deg => (Math.PI / 180) * deg;
