# Copyright (c) 2023 D2ArmorPicker by Mijago.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

"""
A python function that takes a number and returns every possible combination of the factors 3, 5 and 10 which can lead to this number.
It also returns the combination if it "just barely" exceeds N.
N will be in the range of 0-62.
"""


def index_of_first(lst, pred):
    for i, v in enumerate(lst):
        if pred(v):
            return i
    return None


def factor_combinations_with_overflow(n, mustBeExact=False, exactValue=0):
    result = []
    for i in range(0, min(6, n // 3 + 2)):
        if i * 3 >= n and i > 0:
            result.append([i, 0, 0, i * 3])
            continue
        for j in range(0, min(6, n // 5 + 2)):
            if i * 3 + j * 5 >= n and j > 0:
                result.append([i, j, 0, i * 3 + j * 5])
                continue

            for k in range(0, min(5 - j + 1, n // 10 + 2)):
                if j + k > 5: continue
                val = i * 3 + j * 5 + k * 10
                if val >= n:
                    result.append([i, j, k, val])

    result = [tuple(x) for x in result]
    result = [
        x for x in result
    #    if index_of_first(result, lambda y: y[0] <= x[0] and y[1] <= x[1] and y[2] <= x[2]) == result.index(x)
        if not mustBeExact or ((x[3] % 10) == (exactValue % 10))
    ]
    result = list(set(result))
    return result


result = dict()
result_zerowaste = dict()

MAX_F = 10*5 + 5*3

for n in range(1, MAX_F+1):
    fact = factor_combinations_with_overflow(n)

    # sort the tuples in fact.
    # - minimize the 4th value
    # - minimize the 3rd value
    # - minimize the 2nd value
    fact = sorted(fact, key=lambda x: (x[3], x[2], x[1], x[0]))
    
    # remove every entry that is equal or higher in all values than any previous entry
    fact = [tuple(x) for x in fact]
    removed_entries = [
        x for x in fact
        if index_of_first(fact, lambda y: y[0] >= x[0] and y[1] >= x[1] and y[2] >= x[2]) == fact.index(x)
    ]  
    fact = [
        x for x in fact
        if index_of_first(fact, lambda y: y[0] <= x[0] and y[1] <= x[1] and y[2] <= x[2]) == fact.index(x)
    ]
    
    result[n] = fact

    fact2 = []

    for m in range(0, 15):
        fact2 += factor_combinations_with_overflow(n + m, mustBeExact=True, exactValue=n)

    # only keep one duplicate
    fact2 = [tuple(x) for x in fact2]
    fact2 = list(set(fact2))

    fact2 = sorted(fact2, key=lambda x: (x[3], x[2], x[1], x[0]))

    result_zerowaste[n] = fact2

# write json
import json

with open('factor_combinations.json', 'w') as fp:
    json.dump(result, fp)
with open('factor_combinations_zerowaste.json', 'w') as fp:
    json.dump(result_zerowaste, fp)
