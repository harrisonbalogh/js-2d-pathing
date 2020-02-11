/**
 * Generate trapezoids for the given {@link Blocker} set.
 * @param {[Blocker]} layout - array of {@link Blocker} objects
 */
function generateTrapezoids(layout) {
    if (!Array.isArray(layout)) throw Error.InvalidParameter

    layout.forEach(blocker => {
        if (!(blocker instanceof Blocker)) throw Error.InvalidParameter

        blocker.vertices.forEach((vertex, i) => {
            let previousVertex = blocker.vertices[(i - 1) < 0 ? blocker.vertices.length - 1 : (i - 1)]
            let nextVertex = blocker.vertices[(i + 1) % blocker.vertices.length]
            
            previousVertex

        })
    })
}